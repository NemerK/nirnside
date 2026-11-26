import { existsSync, readdirSync, readFileSync, rmSync, rmdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ZIP/exe installs update by copying the new files over the old folder, so a
 * file the new version deleted or moved stays behind. Under src/app that is
 * fatal: an old `src/app/inventory/page.tsx` next to the new
 * `src/app/(atlas)/inventory/page.tsx` makes `next build` refuse to run
 * ("two parallel pages that resolve to the same path").
 *
 * This removes only:
 *   1. paths listed in scripts/stale-files.json (files a release removed), and
 *   2. top-level route folders/files in src/app that now live inside a route
 *      group such as (atlas) or (party) — the exact conflict above.
 * It never touches data/, the database, node_modules, .next or anything else.
 */

const here = dirname(fileURLToPath(import.meta.url));

/** Only these top-level folders are app code that a release owns. */
const OWNED = ["src", "scripts", "public", "addon"];

function inside(root, target) {
  const rel = relative(root, target);
  return rel !== "" && !rel.startsWith("..") && !rel.includes(`..${sep}`);
}

function owned(rel) {
  const first = rel.replace(/\\/g, "/").split("/")[0];
  return OWNED.includes(first);
}

function removeEmptyParents(root, file) {
  let dir = dirname(file);
  while (inside(root, dir) && owned(relative(root, dir))) {
    try {
      if (readdirSync(dir).length > 0) return;
      rmdirSync(dir);
    } catch {
      return;
    }
    dir = dirname(dir);
  }
}

export function readStaleList(listPath = join(here, "stale-files.json")) {
  try {
    const parsed = JSON.parse(readFileSync(listPath, "utf8"));
    return Array.isArray(parsed.paths) ? parsed.paths.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

/** Route entries at the top of src/app that a route group now owns. */
export function shadowedAppEntries(root) {
  const app = join(root, "src", "app");
  if (!existsSync(app)) return [];
  let entries;
  try {
    entries = readdirSync(app, { withFileTypes: true });
  } catch {
    return [];
  }
  const groups = entries.filter((e) => e.isDirectory() && /^\(.+\)$/.test(e.name)).map((e) => join(app, e.name));
  if (groups.length === 0) return [];
  const out = [];
  for (const e of entries) {
    if (/^\(.+\)$/.test(e.name) || e.name === "api" || e.name === "fonts") continue;
    // Shared files that stay at the top on purpose.
    if (!e.isDirectory() && !/^(page|layout|loading|error|not-found|template|default)\.(tsx|ts|jsx|js)$/.test(e.name)) continue;
    if (groups.some((g) => existsSync(join(g, e.name)))) out.push(join("src", "app", e.name));
  }
  return out;
}

/** Delete leftovers. Returns the relative paths removed. Safe to run on every start. */
export function pruneStale(root, options = {}) {
  const base = resolve(root);
  const list = options.paths ?? readStaleList(options.listPath);
  const removed = [];
  const targets = [...list, ...shadowedAppEntries(base)];
  for (const rel of targets) {
    if (!owned(rel)) continue;
    const full = resolve(base, rel);
    if (!inside(base, full) || !existsSync(full)) continue;
    try {
      const isDir = statSync(full).isDirectory();
      rmSync(full, { recursive: isDir, force: true });
      removed.push(rel.replace(/\\/g, "/"));
      removeEmptyParents(base, full);
    } catch {
      /* a locked file stays; the next start tries again */
    }
  }
  return removed;
}

/**
 * After a ZIP overlay: delete owned app files the new tree no longer has, so a
 * future move or delete can never leave a duplicate behind.
 */
export function pruneRemovedFiles(fromDir, toDir, shouldSkip = () => false) {
  const removed = [];
  function walk(dir) {
    let ents;
    try {
      ents = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of ents) {
      const full = join(dir, ent.name);
      const rel = relative(toDir, full);
      if (shouldSkip(rel) || ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      if (!existsSync(join(fromDir, rel))) {
        try {
          rmSync(full, { force: true });
          removed.push(rel.replace(/\\/g, "/"));
          removeEmptyParents(toDir, full);
        } catch {
          /* leave it; pruneStale covers known leftovers */
        }
      }
    }
  }
  for (const top of OWNED) {
    if (existsSync(join(fromDir, top))) walk(join(toDir, top));
  }
  return removed;
}
