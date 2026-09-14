import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { watch, type FSWatcher } from "chokidar";
import { loadSnapshotFromFile } from "./load";
import { locateSnapshot, candidatePaths, type SnapshotSource } from "./locate";
import { importSnapshot } from "../db/import";
import { getDb, setMeta } from "../db";
import { loadReferenceCatalog, loadCatalogFromLua } from "../catalog/load";
import { installAddons } from "../setup/install-addons";

/**
 * The "work-free" engine. Started once when the app boots (see instrumentation).
 * It finds the ESO SavedVariables file automatically, imports it, and then
 * watches it so every logout / ReloadUI refreshes the app on its own — no env
 * vars, no second terminal.
 *
 * If no ESO file exists yet (addon not run, or — like the cloud preview — no ESO
 * on this machine), it keeps looking on an interval and picks it up the moment
 * it appears.
 */

export interface DataSourceStatus {
  kind: SnapshotSource["kind"];
  path: string;
  label: string;
  at: number; // last import time (ms)
  ok: boolean;
  error?: string;
}

let started = false;
let watcher: FSWatcher | null = null;
let debounce: NodeJS.Timeout | null = null;

function doImport(src: SnapshotSource, reason: string) {
  try {
    const snap = loadSnapshotFromFile(src.path);
    const result = importSnapshot(snap);
    const status: DataSourceStatus = {
      kind: src.kind,
      path: src.path,
      label: src.label,
      at: Date.now(),
      ok: true,
    };
    setMeta("dataSource", status);
    console.log(
      `[nirnside] (${reason}) imported ${snap.displayName} from ${src.label} — ` +
        `${result.characters} chars, ${result.items} items, ${result.sets} sets`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    setMeta("dataSource", { kind: src.kind, path: src.path, label: src.label, at: Date.now(), ok: false, error: message });
    console.error(`[nirnside] import failed for ${src.path}: ${message}`);
  }
}

function beginWatch(src: SnapshotSource) {
  doImport(src, "startup");

  // Sample data is static — no need to watch it.
  if (src.kind === "sample") {
    console.log("[nirnside] Using bundled sample data. Run the app on your ESO PC to load your real account.");
    // Still keep looking for a real ESO file appearing later.
    pollForRealFile();
    return;
  }

  watcher?.close();
  watcher = watch(src.path, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
  });
  const trigger = (reason: string) => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => doImport(src, reason), 600);
  };
  watcher.on("change", () => trigger("change")).on("add", () => trigger("add"));
  console.log(`[nirnside] Watching ${src.path} — logout or /reloadui in ESO to refresh automatically.`);
}

/** When only sample data exists, keep checking for a real ESO file to appear. */
function pollForRealFile() {
  const iv = setInterval(() => {
    const real = locateSnapshot(false);
    if (real) {
      clearInterval(iv);
      console.log(`[nirnside] Detected real account file at ${real.path}.`);
      beginWatch(real);
    }
  }, 20_000);
  if (typeof iv.unref === "function") iv.unref();
}

/** Load the bundled reference catalog, then overlay an in-game dump if present. */
function loadCatalog() {
  try {
    const ref = loadReferenceCatalog();
    console.log(`[nirnside] catalog: loaded ${ref.files} reference file(s).`);
  } catch (err) {
    console.error(`[nirnside] reference catalog failed: ${err instanceof Error ? err.message : err}`);
  }

  // An in-game catalog dump (from the NirnsideCatalog addon) sits next to the
  // snapshot file, or can be dropped into data/incoming. If present, import it
  // (it overrides reference data) and watch it.
  const snap = locateSnapshot(false);
  const candidates = [
    process.env.NIRNSIDE_CATALOG_FILE,
    join(process.cwd(), "data", "incoming", "NirnsideCatalog.lua"),
    snap ? join(dirname(snap.path), "NirnsideCatalog.lua") : undefined,
  ].filter((p): p is string => !!p);
  const catalogPath = candidates.find((p) => existsSync(p));
  if (catalogPath && existsSync(catalogPath)) {
    try {
      loadCatalogFromLua(catalogPath);
      console.log(`[nirnside] catalog: applied in-game dump from ${catalogPath}`);
    } catch (err) {
      console.error(`[nirnside] in-game catalog import failed: ${err instanceof Error ? err.message : err}`);
    }
    watch(catalogPath, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 } }).on(
      "all",
      () => {
        try {
          loadCatalogFromLua(catalogPath);
          console.log("[nirnside] catalog: re-applied in-game dump.");
        } catch (err) {
          console.error(`[nirnside] in-game catalog re-import failed: ${err instanceof Error ? err.message : err}`);
        }
      },
    );
  }
}

/** Install/update our addons into any ESO AddOns folder found on this machine. */
function autoSetup() {
  try {
    const res = installAddons();
    if (res.addOnsDirs.length > 0) {
      const changed = res.installed.length + res.updated.length;
      console.log(
        `[nirnside] auto-setup: ${res.addOnsDirs.length} AddOns folder(s); ` +
          `${res.installed.length} installed, ${res.updated.length} updated, ${res.upToDate.length} up-to-date.`,
      );
      setMeta("autoSetup", {
        addOnsDirs: res.addOnsDirs,
        changed,
        installed: res.installed,
        updated: res.updated,
        errors: res.errors,
        at: Date.now(),
      });
    } else {
      setMeta("autoSetup", { addOnsDirs: [], changed: 0, installed: [], updated: [], errors: [], at: Date.now() });
    }
  } catch (err) {
    console.error(`[nirnside] auto-setup failed: ${err instanceof Error ? err.message : err}`);
  }
}

export function startAutoImport() {
  if (started) return;
  started = true;

  autoSetup();
  loadCatalog();

  // Real data only. We never auto-load the sample account — showing fabricated
  // data as if it were yours violates the accuracy rule. The demo is opt-in
  // (see loadSampleData / the Home page button).
  const found = locateSnapshot(false);
  if (found) {
    beginWatch(found);
    return;
  }

  console.log(
    "[nirnside] No SavedVariables found yet. Looking in:\n  " +
      candidatePaths().slice(0, 6).join("\n  ") +
      "\nInstall the addon and log out once; it'll be picked up automatically.",
  );
  const iv = setInterval(() => {
    const src = locateSnapshot(false);
    if (src) {
      clearInterval(iv);
      beginWatch(src);
    }
  }, 20_000);
  if (typeof iv.unref === "function") iv.unref();
}

/** Opt-in: import the bundled sample account so users can tour a populated app. */
export function loadSampleData(): boolean {
  const sample = join(process.cwd(), "data", "sample", "Nirnside.lua");
  if (!existsSync(sample)) return false;
  doImport({ kind: "sample", path: sample, label: "sample data" }, "demo");
  return true;
}

/** Clear the imported account (returns the app to its honest empty state). */
export function clearAccountData(): void {
  try {
    const db = getDb();
    db.exec("DELETE FROM characters; DELETE FROM items; DELETE FROM stickerbook;");
    db.prepare("DELETE FROM meta WHERE key IN ('account','dataSource')").run();
  } catch (err) {
    console.error(`[nirnside] clear failed: ${err instanceof Error ? err.message : err}`);
  }
}
