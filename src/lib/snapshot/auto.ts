import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { watch, type FSWatcher } from "chokidar";
import { loadSnapshotFromFile } from "./load";
import {
  locateSnapshot,
  candidatePaths,
  incomingPath,
  incomingCatalogPath,
  CATALOG_FILENAME,
  type SnapshotSource,
} from "./locate";
import { importSnapshot } from "../db/import";
import { getDb, getMeta, setMeta } from "../db";
import { loadReferenceCatalog, loadCatalogFromLua } from "../catalog/load";
import { installAddons } from "../setup/install-addons";
import { clearUserConfig, setUserConfig } from "../setup/config";
import { resolveUserPath } from "../setup/resolve-path";

/**
 * The "work-free" engine. Started once when the app boots (see instrumentation).
 * It finds the ESO SavedVariables file automatically, imports it, and then
 * watches it so every logout / ReloadUI refreshes the app on its own — no env
 * vars, no second terminal.
 *
 * If no ESO file exists yet (addon not run, or no ESO on this machine), it keeps
 * looking on an interval and picks it up the moment it appears. Setup can point
 * it at a folder/file at any time via rescanNow().
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
let catalogWatcher: FSWatcher | null = null;
let debounce: NodeJS.Timeout | null = null;
let pollTimer: NodeJS.Timeout | null = null;
let catalogLoaded = false;

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

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function beginWatch(src: SnapshotSource, reason = "startup") {
  doImport(src, reason);

  // Sample data is static — no need to watch it.
  if (src.kind === "sample") {
    console.log("[nirnside] Using bundled sample data. Run the app on your ESO PC to load your real account.");
    pollForRealFile();
    return;
  }

  watcher?.close();
  watcher = watch(src.path, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
  });
  const trigger = (why: string) => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => doImport(src, why), 600);
  };
  watcher.on("change", () => trigger("change")).on("add", () => trigger("add"));
  console.log(`[nirnside] Watching ${src.path} — logout or /reloadui in ESO to refresh automatically.`);
}

function pollForRealFile() {
  stopPoll();
  pollTimer = setInterval(() => {
    const real = locateSnapshot(false);
    if (real && real.kind !== "sample") {
      stopPoll();
      console.log(`[nirnside] Detected real account file at ${real.path}.`);
      beginWatch(real, "detected");
    }
  }, 20_000);
  if (pollTimer && typeof pollTimer.unref === "function") pollTimer.unref();
}

function catalogCandidates(): string[] {
  const snap = locateSnapshot(false);
  return [
    process.env.NIRNSIDE_CATALOG_FILE,
    incomingCatalogPath(),
    snap ? join(dirname(snap.path), CATALOG_FILENAME) : undefined,
  ].filter((p): p is string => !!p);
}

function applyCatalogFile(catalogPath: string, reason: string) {
  try {
    loadCatalogFromLua(catalogPath);
    console.log(`[nirnside] catalog: applied in-game dump from ${catalogPath} (${reason})`);
  } catch (err) {
    console.error(`[nirnside] in-game catalog import failed: ${err instanceof Error ? err.message : err}`);
  }
}

/** Load the bundled reference catalog, then overlay an in-game dump if present. */
function loadCatalog() {
  if (!catalogLoaded) {
    try {
      const ref = loadReferenceCatalog();
      console.log(`[nirnside] catalog: loaded ${ref.files} reference file(s).`);
    } catch (err) {
      console.error(`[nirnside] reference catalog failed: ${err instanceof Error ? err.message : err}`);
    }
    catalogLoaded = true;
  }

  const catalogPath = catalogCandidates().find((p) => existsSync(p));
  catalogWatcher?.close();
  catalogWatcher = null;
  if (!catalogPath) return;

  applyCatalogFile(catalogPath, "startup");
  catalogWatcher = watch(catalogPath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
  });
  catalogWatcher.on("all", () => applyCatalogFile(catalogPath, "change"));
}

/** Install/update our addons into any ESO AddOns folder found on this machine. */
function autoSetup() {
  try {
    const res = installAddons();
    if (res.addOnsDirs.length > 0) {
      const changed = res.installed.length + res.updated.length + res.upToDate.length;
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

/**
 * Re-run addon install, catalog overlay, and snapshot locate/watch.
 * Safe to call from Setup after the user points at a folder.
 */
export function rescanNow(reason = "rescan"): DataSourceStatus | null {
  autoSetup();
  loadCatalog();

  const found = locateSnapshot(false);
  if (found) {
    stopPoll();
    beginWatch(found, reason);
    return getMeta<DataSourceStatus>("dataSource");
  }

  console.log(
    "[nirnside] No SavedVariables found yet. Looking in:\n  " +
      candidatePaths().slice(0, 8).join("\n  ") +
      "\nPoint Nirnside at your ESO folder in Setup, or enable the addon and log out once.",
  );
  pollForRealFile();
  return getMeta<DataSourceStatus>("dataSource");
}

export function startAutoImport() {
  if (started) return;
  started = true;
  rescanNow("startup");
}

/** Point Nirnside at a folder or SavedVariables file the user chose. */
export function applyUserPath(raw: string): { ok: boolean; error?: string } {
  const resolved = resolveUserPath(raw);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  if (resolved.kind === "catalog") {
    try {
      loadCatalogFromLua(resolved.file);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
    const root = dirname(dirname(resolved.file));
    setUserConfig({ esoDir: existsSync(root) ? root : undefined });
    rescanNow("setup-catalog");
    return { ok: true };
  }

  if (resolved.kind === "snapshot") {
    setUserConfig({ snapshotFile: resolved.file, esoDir: resolved.esoRoot });
    rescanNow("setup-file");
    return { ok: true };
  }

  setUserConfig({ esoDir: resolved.esoRoot });
  rescanNow("setup-folder");
  return { ok: true };
}

/** Drop a SavedVariables lua into data/incoming and import it. */
export function applyUploadedLua(filename: string, bytes: Buffer): { ok: boolean; error?: string } {
  const lower = filename.toLowerCase();
  if (!lower.endsWith(".lua")) return { ok: false, error: "Please drop a .lua SavedVariables file." };

  const dest = /catalog/i.test(filename) ? incomingCatalogPath() : incomingPath();
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, bytes);
  if (/catalog/i.test(filename)) {
    try {
      loadCatalogFromLua(dest);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  } else {
    setUserConfig({ snapshotFile: dest });
  }
  rescanNow("upload");
  return { ok: true };
}

export function resetSetupPath(): void {
  clearUserConfig();
  rescanNow("reset-setup");
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
    db.exec("DELETE FROM characters; DELETE FROM items; DELETE FROM stickerbook; DELETE FROM achievements;");
    db.prepare("DELETE FROM meta WHERE key IN ('account','dataSource')").run();
  } catch (err) {
    console.error(`[nirnside] clear failed: ${err instanceof Error ? err.message : err}`);
  }
}
