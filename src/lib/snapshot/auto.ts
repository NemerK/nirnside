import { watch, type FSWatcher } from "chokidar";
import { loadSnapshotFromFile } from "./load";
import { locateSnapshot, candidatePaths, type SnapshotSource } from "./locate";
import { importSnapshot } from "../db/import";
import { setMeta } from "../db";

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

export function startAutoImport() {
  if (started) return;
  started = true;

  const found = locateSnapshot(true);
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
    const src = locateSnapshot(true);
    if (src) {
      clearInterval(iv);
      beginWatch(src);
    }
  }, 20_000);
  if (typeof iv.unref === "function") iv.unref();
}
