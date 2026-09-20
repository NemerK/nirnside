import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { getUserConfig } from "../setup/config";

/**
 * Zero-config discovery of the ESO SavedVariables file the NirnsideSnapshot
 * addon writes. We check every standard ESO location for the current OS so the
 * user never has to configure a path — run the app on the same PC as ESO and it
 * just finds it.
 *
 * Precedence:
 *   1. NIRNSIDE_SV_FILE  (explicit file, escape hatch)
 *   2. NIRNSIDE_SV_DIR   (explicit SavedVariables dir)
 *   3. Path chosen in Setup (a snapshot file or ESO folder)
 *   4. Standard ESO data locations (liveeu preferred, then live, then pts)
 *   5. data/incoming drop-in (machines without ESO)
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

  const docNames = ["Documents", "Documenten", "Dokumente", "Documentos", "Documenti", "文档", "My Documents"];
  const out: string[] = [];
  for (const home of homes) {
    // Direct Documents variants.
    for (const d of docNames) out.push(join(home, d));
    // Any OneDrive* folder under home, then its Documents variants.
    for (const entry of safeReaddir(home)) {
      if (/^onedrive/i.test(entry)) {
        for (const d of docNames) out.push(join(home, entry, d));
      }
    }
  }
  return out;
}

/**
 * Windows drive roots to also probe (C:..Z:), for installs on a non-system
 * drive or a relocated Users folder. No-op on macOS/Linux.
 */
function windowsUserRoots(): string[] {
  if (process.platform !== "win32") return [];
  const out: string[] = [];
  for (let c = 67; c <= 90; c++) {
    const drive = String.fromCharCode(c) + ":\\";
    const users = join(drive, "Users");
    if (!isDir(users)) continue;
    for (const user of safeReaddir(users)) {
      const base = join(users, user);
      out.push(join(base, "Documents"));
      for (const entry of safeReaddir(base)) {
        if (/^onedrive/i.test(entry)) out.push(join(base, entry, "Documents"));
      }
    }
  }
  return out;
}

/** Roots under which the "Elder Scrolls Online" folder typically lives. */
export function esoRoots(): string[] {
  const roots: string[] = [];
  // Chosen folder first so a Setup pick always wins over other copies (OneDrive vs local, NA vs EU).
  const chosen = getUserConfig().esoDir;
  if (chosen) roots.push(chosen);
  if (process.env.NIRNSIDE_ESO_DIR) roots.push(process.env.NIRNSIDE_ESO_DIR);
  for (const docs of [...documentsDirs(), ...windowsUserRoots()]) {
    roots.push(join(docs, ESO_DIRNAME));
  }
  return Array.from(new Set(roots)).filter(isDir);
}

/**
 * Environment folders (liveeu/live/pts, plus any other folder that has a
 * SavedVariables subdir) under a given ESO root, in preference order.
 */
export function envFolders(root: string): string[] {
  const known = ESO_ENVS.filter((e) => isDir(join(root, e)));
  const extra = safeReaddir(root).filter(
    (e) => !ESO_ENVS.includes(e as (typeof ESO_ENVS)[number]) && isDir(join(root, e, "SavedVariables")),
  );
  const found = [...known, ...extra];
  // The user pointed at live / liveeu itself rather than the parent ESO folder.
  if (found.length === 0 && (isDir(join(root, "SavedVariables")) || isDir(join(root, "AddOns")))) {
    return [""];
  }
  return found;
}

/** Every candidate SavedVariables file path we'd consider, in priority order. */
export function candidatePaths(): string[] {
  const out: string[] = [];
  const cfg = getUserConfig();
  if (cfg.snapshotFile) out.push(cfg.snapshotFile);
  out.push(incomingPath());
  for (const root of esoRoots()) {
    for (const env of envFolders(root)) {
      out.push(join(root, env, "SavedVariables", SNAPSHOT_FILENAME));
    }
  }
  return Array.from(new Set(out));
}

const SAMPLE_PATH = join(process.cwd(), "data", "sample", "Nirnside.lua");

/**
 * Resolve the snapshot file to use right now, or null if nothing (not even the
 * sample) exists. Pass includeSample=false to only accept a real ESO file.
 */
export function locateSnapshot(includeSample = true): SnapshotSource | null {
  const envFile = process.env.NIRNSIDE_SV_FILE;
  if (envFile && existsSync(envFile)) {
    return { kind: "env", path: envFile, label: "NIRNSIDE_SV_FILE" };
  }

  const envDir = process.env.NIRNSIDE_SV_DIR;
  if (envDir) {
    const p = join(envDir, SNAPSHOT_FILENAME);
    if (existsSync(p)) return { kind: "env", path: p, label: "NIRNSIDE_SV_DIR" };
  }

  const cfg = getUserConfig();
  if (cfg.snapshotFile && existsSync(cfg.snapshotFile)) {
    return { kind: "eso", path: cfg.snapshotFile, label: "chosen file" };
  }

  for (const root of esoRoots()) {
    for (const env of envFolders(root)) {
      const p = join(root, env, "SavedVariables", SNAPSHOT_FILENAME);
      if (existsSync(p)) {
        const envLabel = env || basenameLabel(root);
        const chosen = cfg.esoDir && samePath(root, cfg.esoDir);
        return { kind: "eso", path: p, label: chosen ? `chosen folder (${envLabel})` : envLabel };
      }
    }
  }

  const incoming = incomingPath();
  if (existsSync(incoming)) {
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
