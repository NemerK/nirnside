import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Zero-config discovery of the ESO SavedVariables file the NirnsideSnapshot
 * addon writes. We check every standard ESO location for the current OS so the
 * user never has to configure a path — run the app on the same PC as ESO and it
 * just finds it.
 *
 * Precedence:
 *   1. NIRNSIDE_SV_FILE  (explicit file, escape hatch)
 *   2. NIRNSIDE_SV_DIR   (explicit SavedVariables dir)
 *   3. Standard ESO install locations (liveeu preferred, then live, then pts)
 *   4. The bundled sample fixture (so a fresh clone still shows something)
 */

export const SNAPSHOT_FILENAME = "NirnsideSnapshot.lua";

export type SnapshotSource =
  | { kind: "env"; path: string; label: string }
  | { kind: "eso"; path: string; label: string }
  | { kind: "sample"; path: string; label: string };

/** ESO "live" environment folders, most-preferred first. */
const ESO_ENVS = ["liveeu", "live", "pts"] as const;

/** Roots under which "Elder Scrolls Online" typically lives. */
function esoRoots(): string[] {
  const home = homedir();
  const roots = [
    join(home, "Documents", "Elder Scrolls Online"),
    // Windows with OneDrive-redirected Documents.
    join(home, "OneDrive", "Documents", "Elder Scrolls Online"),
    // Some localized Windows setups.
    join(home, "OneDrive", "Documenten", "Elder Scrolls Online"),
    // macOS keeps it under Documents too; already covered by the first entry.
  ];
  // Windows explicit env var, if present.
  if (process.env.USERPROFILE) {
    roots.push(join(process.env.USERPROFILE, "Documents", "Elder Scrolls Online"));
    roots.push(join(process.env.USERPROFILE, "OneDrive", "Documents", "Elder Scrolls Online"));
  }
  return Array.from(new Set(roots));
}

/** Every candidate SavedVariables file path we'd consider, in priority order. */
export function candidatePaths(): string[] {
  const out: string[] = [];
  for (const root of esoRoots()) {
    for (const env of ESO_ENVS) {
      out.push(join(root, env, "SavedVariables", SNAPSHOT_FILENAME));
    }
  }
  return out;
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

  for (const root of esoRoots()) {
    for (const env of ESO_ENVS) {
      const p = join(root, env, "SavedVariables", SNAPSHOT_FILENAME);
      if (existsSync(p)) return { kind: "eso", path: p, label: env };
    }
  }

  if (includeSample && existsSync(SAMPLE_PATH)) {
    return { kind: "sample", path: SAMPLE_PATH, label: "sample data" };
  }
  return null;
}
