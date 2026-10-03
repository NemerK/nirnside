import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { getUserConfig } from "../setup/config";
import { windowsKnownDocumentDirs } from "../setup/windows-known-folders";

/**
 * Join a runtime ESO / Documents path. Same as path.join — the ignore marker
 * only stops Turbopack from tracing the whole project during `next build`.
 * Search order is unchanged.
 */
function esoJoin(...parts: string[]): string {
  return join(/* turbopackIgnore: true */ ...parts);
}

/**
 * Zero-config discovery of the ESO SavedVariables file the NirnsideSnapshot
 * addon writes. Locked default — do not reorder, widen, or replace this in
 * feature work, even if a later prompt sounds path-related
 * (see .cursor/rules/eso-paths.mdc). Run the app on the same PC as ESO and
 * it finds the file.
 *
 * Precedence:
 *   1. NIRNSIDE_SV_FILE  (explicit file, escape hatch)
 *   2. NIRNSIDE_SV_DIR   (explicit SavedVariables dir)
 *   3. Path chosen in Setup (a snapshot file or ESO folder)
 *   4. Standard ESO data locations (liveeu, then live, then pts — first file
 *      wins. Folder name is not the megaserver; Steam/PC EU is often `live`.)
 *   5. data/incoming drop-in (machines without ESO only)
 *   6. The bundled sample fixture (opt-in demo only)
 */

// ESO names the SavedVariables file after the ADDON (NirnsideSnapshot.lua) and
// stores the declared variable (NirnsideData) *inside* it. So the file on disk
// is <env>/SavedVariables/NirnsideSnapshot.lua.
export const SNAPSHOT_FILENAME = "NirnsideSnapshot.lua";
export const CATALOG_FILENAME = "NirnsideCatalog.lua";

export type SnapshotSource =
  | { kind: "env"; path: string; label: string }
  | { kind: "uploaded"; path: string; label: string }
  | { kind: "eso"; path: string; label: string }
  | { kind: "sample"; path: string; label: string };

/**
 * Drop-in folder for a manually provided file. Useful when the app runs on a
 * machine without ESO (e.g. a remote/cloud instance): put your real
 * NirnsideSnapshot.lua here and it's imported and watched like a local file.
 */
export function incomingPath(): string {
  return join(process.cwd(), "data", "incoming", SNAPSHOT_FILENAME);
}

export function incomingCatalogPath(): string {
  return join(process.cwd(), "data", "incoming", CATALOG_FILENAME);
}

/** ESO "live" environment folders, most-preferred first. */
const ESO_ENVS = ["liveeu", "live", "pts"] as const;

const ESO_DIRNAME = "Elder Scrolls Online";

function safeReaddir(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * The "Documents" folders to look under. Covers plain Documents, OneDrive (any
 * "OneDrive*" folder, including business "OneDrive - Company"), and a few
 * localized Documents names — across the home dir and USERPROFILE.
 */
function documentsDirs(): string[] {
  const homes = new Set<string>([homedir()]);
  if (process.env.USERPROFILE) homes.add(process.env.USERPROFILE);
  if (process.env.HOME) homes.add(process.env.HOME);
  for (const key of ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"] as const) {
    const v = process.env[key];
    if (v) homes.add(v);
  }

  const docNames = ["Documents", "Documenten", "Dokumente", "Documentos", "Documenti", "文档", "My Documents"];
  const out: string[] = [...windowsKnownDocumentDirs()];
  for (const key of ["OneDrive", "OneDriveConsumer", "OneDriveCommercial"] as const) {
    const v = process.env[key];
    if (v) out.push(esoJoin(v, "Documents"));
  }
  for (const home of homes) {
    // Direct Documents variants.
    for (const d of docNames) out.push(esoJoin(home, d));
    // Any OneDrive* folder under home, then its Documents variants.
    for (const entry of safeReaddir(home)) {
      if (/^onedrive/i.test(entry)) {
        for (const d of docNames) out.push(esoJoin(home, entry, d));
      }
    }
  }
  return out;
}

const SKIP_WINDOWS_USERS = new Set(["public", "default", "default user", "all users", "defaultapppool"]);

function collectWindowsUserDocs(usersDir: string): string[] {
  const out: string[] = [];
  if (!isDir(usersDir)) return out;
  for (const user of safeReaddir(usersDir)) {
    if (SKIP_WINDOWS_USERS.has(user.toLowerCase())) continue;
    const base = esoJoin(usersDir, user);
    if (!isDir(base)) continue;
    out.push(esoJoin(base, "Documents"));
    for (const entry of safeReaddir(base)) {
      if (/^onedrive/i.test(entry)) out.push(esoJoin(base, entry, "Documents"));
    }
  }
  return out;
}

/**
 * Drive letters implied by real user paths. Never walk A–Z: a disconnected
 * network letter blocks `stat` and freezes the Windows exe at 98%.
 */
export function driveLettersFromPaths(paths: Array<string | null | undefined>): string[] {
  const drives = new Set<string>();
  for (const raw of paths) {
    if (!raw) continue;
    const m = raw.replace(/\//g, "\\").match(/^([a-zA-Z]:)/);
    if (m) drives.add(`${m[1].toUpperCase()}\\`);
  }
  return [...drives];
}

/** Windows Users folders on the profile / system drive only. No-op elsewhere. */
function windowsUserRoots(): string[] {
  if (process.platform !== "win32") return [];
  const drives = driveLettersFromPaths([
    process.env.SystemDrive ? `${process.env.SystemDrive}\\` : "C:\\",
    process.env.USERPROFILE,
    process.env.HOMEDRIVE ? `${process.env.HOMEDRIVE}\\` : null,
    homedir(),
  ]);
  if (drives.length === 0) drives.push("C:\\");
  const out: string[] = [];
  for (const drive of drives) {
    out.push(...collectWindowsUserDocs(esoJoin(drive, "Users")));
  }
  return out;
}

/**
 * WSL (and similar) mounts of Windows drives. ESO's files live under
 * C:\Users\...\Documents, which is /mnt/c/Users/... here — not /home/ubuntu.
 */
export function windowsMountRoots(): string[] {
  if (process.platform === "win32") return [];
  const out: string[] = [];
  for (const letter of "cdefghijklmnopqrstuvwxyz") {
    out.push(...collectWindowsUserDocs(`/mnt/${letter}/Users`));
  }
  return out;
}

/** True when this process can see a real Windows Documents tree (native or WSL). */
export function seesWindowsDocuments(): boolean {
  return process.platform === "win32" || windowsMountRoots().length > 0;
}

/** Roots under which the "Elder Scrolls Online" folder typically lives. */
export function esoRoots(): string[] {
  const roots: string[] = [];
  // Chosen folder first so a Setup pick always wins over other copies (OneDrive vs local, NA vs EU).
  const chosen = getUserConfig().esoDir;
  if (chosen) roots.push(chosen);
  if (process.env.NIRNSIDE_ESO_DIR) roots.push(process.env.NIRNSIDE_ESO_DIR);
  for (const docs of [...documentsDirs(), ...windowsUserRoots(), ...windowsMountRoots()]) {
    roots.push(esoJoin(docs, ESO_DIRNAME));
  }
  return Array.from(new Set(roots)).filter(isDir);
}

/**
 * Environment folders (liveeu/live/pts, plus any other folder that has a
 * SavedVariables subdir) under a given ESO root, in preference order.
 */
export function envFolders(root: string): string[] {
  const known = ESO_ENVS.filter((e) => isDir(esoJoin(root, e)));
  const extra = safeReaddir(root).filter(
    (e) => !ESO_ENVS.includes(e as (typeof ESO_ENVS)[number]) && isDir(esoJoin(root, e, "SavedVariables")),
  );
  const found = [...known, ...extra];
  // The user pointed at live / liveeu itself rather than the parent ESO folder.
  if (found.length === 0 && (isDir(esoJoin(root, "SavedVariables")) || isDir(esoJoin(root, "AddOns")))) {
    return [""];
  }
  return found;
}

/** data/incoming drop-in — last resort only, never a chosen/live ESO path. */
export function isIncomingPath(path: string | null | undefined): boolean {
  if (!path) return false;
  return path.replace(/\\/g, "/").toLowerCase().includes("/data/incoming/");
}

/** Every ESO SavedVariables path we'd consider, in priority order. */
export function candidatePaths(): string[] {
  const out: string[] = [];
  const cfg = getUserConfig();
  if (cfg.snapshotFile && !isIncomingPath(cfg.snapshotFile)) out.push(cfg.snapshotFile);
  for (const root of esoRoots()) {
    for (const env of envFolders(root)) {
      out.push(esoJoin(root, env, "SavedVariables", SNAPSHOT_FILENAME));
    }
  }
  return Array.from(new Set(out));
}

const SAMPLE_PATH = join(process.cwd(), "data", "sample", "Nirnside.lua");

/** Bundled tour fixture — never treat this as a player's SavedVariables file. */
export function isBundledSamplePath(path: string | null | undefined): boolean {
  if (!path) return false;
  const n = path.replace(/\\/g, "/").toLowerCase();
  return n.endsWith("/data/sample/nirnside.lua");
}

export function bundledSamplePath(): string {
  return SAMPLE_PATH;
}

function usableFile(path: string | null | undefined): path is string {
  return !!path && existsSync(path) && !isBundledSamplePath(path);
}

/**
 * Resolve the snapshot file to use right now, or null if nothing (not even the
 * sample) exists. Pass includeSample=false to only accept a real ESO file.
 */
export function locateSnapshot(includeSample = true): SnapshotSource | null {
  const envFile = process.env.NIRNSIDE_SV_FILE;
  if (usableFile(envFile)) {
    return { kind: "env", path: envFile, label: "NIRNSIDE_SV_FILE" };
  }

  const envDir = process.env.NIRNSIDE_SV_DIR;
  if (envDir) {
    const p = esoJoin(envDir, SNAPSHOT_FILENAME);
    if (usableFile(p)) return { kind: "env", path: p, label: "NIRNSIDE_SV_DIR" };
  }

  const cfg = getUserConfig();
  if (usableFile(cfg.snapshotFile) && !isIncomingPath(cfg.snapshotFile)) {
    return { kind: "eso", path: cfg.snapshotFile, label: "chosen file" };
  }

  for (const root of esoRoots()) {
    for (const env of envFolders(root)) {
      const p = esoJoin(root, env, "SavedVariables", SNAPSHOT_FILENAME);
      if (existsSync(p)) {
        const envLabel = env || basenameLabel(root);
        const chosen = cfg.esoDir && samePath(root, cfg.esoDir);
        return { kind: "eso", path: p, label: chosen ? `chosen folder (${envLabel})` : envLabel };
      }
    }
  }

  const incoming = incomingPath();
  if (usableFile(incoming)) {
    return { kind: "uploaded", path: incoming, label: "uploaded file (data/incoming)" };
  }

  if (includeSample && existsSync(SAMPLE_PATH)) {
    return { kind: "sample", path: SAMPLE_PATH, label: "sample data" };
  }
  return null;
}

function basenameLabel(root: string): string {
  return basename(root) || root;
}

function samePath(a: string, b: string): boolean {
  const norm = (s: string) => s.replace(/[\\/]+$/, "").toLowerCase();
  return norm(a) === norm(b);
}
