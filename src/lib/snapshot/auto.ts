import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { watch, type FSWatcher } from "chokidar";
import { loadSnapshotFromFile } from "./load";
import {
  locateSnapshot,
  candidatePaths,
  incomingPath,
  incomingCatalogPath,
  CATALOG_FILENAME,
  isBundledSamplePath,
  rankLiveSnapshotFiles,
  type SnapshotSource,
} from "./locate";
import { importSnapshot } from "../db/import";
import { getDb, getMeta, setMeta } from "../db";
import { isBundledSampleAccount, looksLikeBundledSample } from "./load";
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

const LAST_LIVE_KEY = "lastLiveSnapshot";

function snapshotFingerprint(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function isSampleSource(src: SnapshotSource): boolean {
  return src.kind === "sample" || isBundledSamplePath(src.path);
}

function liveAccountName(): string | null {
  try {
    const name = getMeta<{ displayName?: string }>("account")?.displayName;
    if (!name || isBundledSampleAccount(name) || name.toLowerCase() === "@unknown") return null;
    return name;
  } catch {
    return null;
  }
}

function rememberLiveSource(src: SnapshotSource) {
  if (isSampleSource(src)) return;
  setMeta(LAST_LIVE_KEY, { path: src.path, kind: src.kind, label: src.label, at: Date.now() });
}

function lastLiveSource(): SnapshotSource | null {
  try {
    const prev = getMeta<{ path?: string; kind?: SnapshotSource["kind"]; label?: string }>(LAST_LIVE_KEY);
    if (!prev?.path || !existsSync(prev.path) || isBundledSamplePath(prev.path)) return null;
    try {
      if (looksLikeBundledSample(loadSnapshotFromFile(prev.path))) return null;
    } catch {
      return null;
    }
    const kind = prev.kind && prev.kind !== "sample" ? prev.kind : "eso";
    return { kind, path: prev.path, label: prev.label || "last live snapshot" };
  } catch {
    return null;
  }
}

/** Don't keep Setup pinned to a copy of the @AzuraStar tour fixture. */
function forgetPinnedSampleFile() {
  try {
    const cfg = getUserConfig();
    if (!cfg.snapshotFile) return;
    if (isBundledSamplePath(cfg.snapshotFile)) {
      setUserConfig({ esoDir: cfg.esoDir });
      return;
    }
    if (!existsSync(cfg.snapshotFile)) return;
    if (looksLikeBundledSample(loadSnapshotFromFile(cfg.snapshotFile))) {
      setUserConfig({ esoDir: cfg.esoDir });
    }
  } catch {
    // Leave the saved path if we cannot read it.
  }
}

function sameSnapshotPath(a: string, b: string): boolean {
  return a.replace(/\\/g, "/").toLowerCase() === b.replace(/\\/g, "/").toLowerCase();
}

/** Real SavedVariables only — never the bundled @AzuraStar fixture. */
function locateRealSnapshot(excludePath?: string): SnapshotSource | null {
  const paths = candidatePaths().filter((p) => !excludePath || !sameSnapshotPath(p, excludePath));
  const best = rankLiveSnapshotFiles(paths)[0];
  if (best) return best;
  const last = lastLiveSource();
  if (last && (!excludePath || !sameSnapshotPath(last.path, excludePath))) return last;
  return null;
}

function doImport(src: SnapshotSource, reason: string) {
  if (isSampleSource(src)) {
    const real = locateRealSnapshot();
    if (real) {
      console.log(`[nirnside] ignoring sample data; using ${real.path}`);
      src = real;
    } else if (liveAccountName()) {
      console.log(`[nirnside] refusing to replace ${liveAccountName()} with sample data`);
      return;
    }
  }

  try {
    const hash = snapshotFingerprint(src.path);
    const prev = getMeta<{ hash?: string }>("snapshotHash");
    if (reason !== "startup" && reason !== "demo" && reason !== "upload" && prev?.hash === hash) {
      console.log(`[nirnside] (${reason}) snapshot unchanged — skip import`);
      return;
    }
    const snap = loadSnapshotFromFile(src.path);
    if (looksLikeBundledSample(snap) || isBundledSampleAccount(snap.displayName)) {
      const real = locateRealSnapshot(src.path);
      if (real && !sameSnapshotPath(real.path, src.path)) {
        console.log(`[nirnside] ${src.path} is the sample account; switching to ${real.path}`);
        doImport(real, reason);
        return;
      }
      if (liveAccountName()) {
        console.log(`[nirnside] refusing to replace ${liveAccountName()} with @AzuraStar`);
        return;
      }
      src = { kind: "sample", path: src.path, label: "sample data" };
    }
    const result = importSnapshot(snap);
    setMeta("snapshotHash", { hash, at: Date.now() });
    const status: DataSourceStatus = {
      kind: src.kind,
      path: src.path,
      label: src.label,
      at: Date.now(),
      ok: true,
    };
    setMeta("dataSource", status);
    if (!isSampleSource(src) && !isBundledSampleAccount(snap.displayName)) {
      rememberLiveSource(src);
    }
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
  if (isSampleSource(src)) {
    const real = locateRealSnapshot();
    if (real) src = real;
  }
  doImport(src, reason);

  const imported = getMeta<DataSourceStatus>("dataSource");
  const accountName = getMeta<{ displayName?: string }>("account")?.displayName;
  if (imported?.kind === "sample" || isBundledSampleAccount(accountName)) {
    console.log("[nirnside] Using bundled sample data. Run the app on your ESO PC to load your real account.");
    pollForRealFile();
    return;
  }

  const watchPath = imported?.ok ? imported.path : src.path;
  watcher?.close();
  watcher = watch(watchPath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
  });
  const trigger = (why: string) => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => doImport({ kind: imported?.kind ?? src.kind, path: watchPath, label: imported?.label ?? src.label }, why), 600);
  };
  watcher.on("change", () => trigger("change")).on("add", () => trigger("add"));
  console.log(`[nirnside] Watching ${watchPath} — logout or /reloadui in ESO to refresh automatically.`);
}

function pollForRealFile() {
  stopPoll();
  const tryNow = () => {
    const real = locateRealSnapshot();
    if (real) {
      stopPoll();
      console.log(`[nirnside] Detected real account file at ${real.path}.`);
      beginWatch(real, "detected");
      return true;
    }
    return false;
  };
  if (tryNow()) return;
  pollTimer = setInterval(tryNow, 3_000);
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
  forgetPinnedSampleFile();
  autoSetup();
  loadCatalog();

  const found = locateRealSnapshot();
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
    try {
      if (isBundledSamplePath(resolved.file) || looksLikeBundledSample(loadSnapshotFromFile(resolved.file))) {
        setUserConfig({ esoDir: resolved.esoRoot });
        rescanNow("setup-file");
        return { ok: true };
      }
    } catch {
      // If we cannot read it, still remember the path so Setup can show the error.
    }
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
  const real = locateRealSnapshot();
  if (real) {
    console.log(`[nirnside] demo blocked — a live snapshot is at ${real.path}`);
    beginWatch(real, "demo-blocked");
    return false;
  }
  const sample = join(process.cwd(), "data", "sample", "Nirnside.lua");
  if (!existsSync(sample)) return false;
  doImport({ kind: "sample", path: sample, label: "sample data" }, "demo");
  pollForRealFile();
  return true;
}

/** Leave the sample account and reload the live snapshot when we have one. */
export function exitDemo(): void {
  const real = locateRealSnapshot();
  if (real) {
    beginWatch(real, "exit-demo");
    return;
  }
  clearAccountData();
  pollForRealFile();
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
