import { existsSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { envFolders } from "../snapshot/locate";

export type ResolvedUserPath =
  | {
      ok: true;
      kind: "eso-root";
      /** Folder that contains live / liveeu / pts (or is itself an env folder). */
      esoRoot: string;
      envs: string[];
    }
  | {
      ok: true;
      kind: "snapshot";
      file: string;
      esoRoot?: string;
    }
  | {
      ok: true;
      kind: "catalog";
      file: string;
    }
  | { ok: false; error: string };

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

const ESO_FOLDER = "elder scrolls online";
const ENV_NAMES = new Set(["live", "liveeu", "pts"]);

function looksLikeEsoRoot(dir: string): boolean {
  if (basename(dir).toLowerCase() === ESO_FOLDER) return true;
  return envFolders(dir).length > 0;
}

function looksLikeEnvFolder(dir: string): boolean {
  const name = basename(dir).toLowerCase();
  if (ENV_NAMES.has(name)) return true;
  return isDir(join(dir, "SavedVariables")) || isDir(join(dir, "AddOns"));
}

/** Walk up from a file/folder until we find the ESO data root, if it's there. */
function inferEsoRoot(start: string): string | undefined {
  let dir = isFile(start) ? dirname(start) : start;
  for (let i = 0; i < 5; i++) {
    if (looksLikeEsoRoot(dir)) return dir;
    if (looksLikeEnvFolder(dir)) {
      const parent = dirname(dir);
      if (looksLikeEsoRoot(parent)) return parent;
      return dir;
    }
    const child = join(dir, "Elder Scrolls Online");
    if (isDir(child) && looksLikeEsoRoot(child)) return child;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/**
 * Turn whatever the user typed or picked (Documents, the ESO folder, liveeu,
 * SavedVariables, or a .lua file) into a concrete root or snapshot path.
 */
export function resolveUserPath(input: string): ResolvedUserPath {
  const trimmed = input.trim().replace(/^["']|["']$/g, "");
  if (!trimmed) return { ok: false, error: "Enter a folder or file path." };

  const p = resolve(trimmed);
  if (!existsSync(p)) {
    return { ok: false, error: `Nothing exists at ${p}` };
  }

  if (isFile(p)) {
    if (!p.toLowerCase().endsWith(".lua")) {
      return { ok: false, error: "Pick a .lua SavedVariables file, or an ESO data folder." };
    }
    if (/catalog/i.test(basename(p))) {
      return { ok: true, kind: "catalog", file: p };
    }
    return { ok: true, kind: "snapshot", file: p, esoRoot: inferEsoRoot(p) };
  }

  if (!isDir(p)) {
    return { ok: false, error: `Not a folder or file: ${p}` };
  }

  let dir = p;
  const base = basename(dir).toLowerCase();
  if (base === "savedvariables" || base === "addons") dir = dirname(dir);

  const root = inferEsoRoot(dir);
  if (root) {
    const envs = envFolders(root);
    if (envs.length === 0) {
      return {
        ok: false,
        error:
          "Found an ESO-looking folder but no live / liveeu / pts data inside it. Open the game once so it creates those folders, then try again.",
      };
    }
    return { ok: true, kind: "eso-root", esoRoot: root, envs };
  }

  return {
    ok: false,
    error:
      "That folder doesn't look like ESO's data folder. Point Nirnside at Documents\\Elder Scrolls Online — or the live / liveeu folder inside it.",
  };
}
