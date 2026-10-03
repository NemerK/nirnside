import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { esoRoots, windowsMountRoots } from "../snapshot/locate";

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
 * Where the in-app folder picker should open. Documents / Elder Scrolls Online
 * when we can see it — never a bare Linux home like /home/ubuntu.
 */
export interface BrowsePlace {
  label: string;
  path: string;
}

export function browsePlaces(): BrowsePlace[] {
  const places: BrowsePlace[] = [];
  const seen = new Set<string>();
  const add = (label: string, dir: string) => {
    if (!dir || !isDir(dir)) return;
    const key = dir.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    places.push({ label, path: dir });
  };

  for (const root of esoRoots()) add("Elder Scrolls Online", root);

  const docs = [
    ...windowsMountRoots(),
    process.env.OneDrive ? join(/* turbopackIgnore: true */ process.env.OneDrive, "Documents") : "",
    process.env.USERPROFILE ? join(/* turbopackIgnore: true */ process.env.USERPROFILE, "Documents") : "",
    join(/* turbopackIgnore: true */ homedir(), "Documents"),
  ];
  for (const dir of docs) {
    if (!dir) continue;
    add("Documents", dir);
    add("Elder Scrolls Online", join(/* turbopackIgnore: true */ dir, "Elder Scrolls Online"));
  }

  if (process.platform === "win32") {
    for (let c = 67; c <= 90; c++) {
      const letter = String.fromCharCode(c);
      add(`${letter}:`, `${letter}:\\`);
    }
  }

  return places;
}

export function defaultBrowsePath(): string {
  const eso = esoRoots()[0];
  if (eso) return eso;

  const docs: string[] = [...windowsMountRoots()];
  if (process.env.OneDrive) docs.push(join(/* turbopackIgnore: true */ process.env.OneDrive, "Documents"));
  if (process.env.USERPROFILE) docs.push(join(/* turbopackIgnore: true */ process.env.USERPROFILE, "Documents"));
  docs.push(join(/* turbopackIgnore: true */ homedir(), "Documents"));

  for (const dir of docs) {
    const esoDir = join(/* turbopackIgnore: true */ dir, "Elder Scrolls Online");
    if (isDir(esoDir)) return esoDir;
  }
  for (const dir of docs) {
    if (isDir(dir)) return dir;
  }
  return homedir();
}

/**
 * List folders (and .lua files) under a path so the Setup page can pick an ESO
 * data folder without the user having to type a long Windows path.
 */
export function browseDir(requested?: string | null): BrowseResult {
  const home = defaultBrowsePath();
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
      const full = join(/* turbopackIgnore: true */ path, name);
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
  return defaultBrowsePath();
}

export function basenameOf(p: string): string {
  return basename(p);
}
