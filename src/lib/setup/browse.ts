import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const HIDDEN = new Set(["node_modules", ".git", ".cache", ".next", ".cursor"]);

export interface BrowseEntry {
  name: string;
  path: string;
  kind: "dir" | "lua";
}

export interface BrowseResult {
  path: string;
  parent: string | null;
  entries: BrowseEntry[];
  error?: string;
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/**
 * List folders (and .lua files) under a path so the Setup page can pick an ESO
 * data folder without the user having to type a long Windows path.
 */
export function browseDir(requested?: string | null): BrowseResult {
  const home = homedir();
  const raw = (requested ?? "").trim() || home;
  let path: string;
  try {
    path = resolve(raw);
  } catch {
    return { path: home, parent: null, entries: [], error: "Invalid path." };
  }

  if (!existsSync(path) || !isDir(path)) {
    return { path, parent: dirname(path), entries: [], error: "That folder doesn't exist." };
  }

  const parent = dirname(path) === path ? null : dirname(path);
  const entries: BrowseEntry[] = [];
  try {
    for (const name of readdirSync(path)) {
      if (HIDDEN.has(name) || name.startsWith(".")) continue;
      const full = join(path, name);
      try {
        const st = statSync(full);
        if (st.isDirectory()) entries.push({ name, path: full, kind: "dir" });
        else if (st.isFile() && name.toLowerCase().endsWith(".lua")) {
          entries.push({ name, path: full, kind: "lua" });
        }
      } catch {
        /* skip unreadable */
      }
    }
  } catch (err) {
    return {
      path,
      parent,
      entries: [],
      error: err instanceof Error ? err.message : "Couldn't read that folder.",
    };
  }

  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { path, parent, entries };
}

export function browseHome(): string {
  return homedir();
}

export function basenameOf(p: string): string {
  return basename(p);
}
