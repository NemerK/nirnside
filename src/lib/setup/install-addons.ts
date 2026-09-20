import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { esoRoots, envFolders } from "../snapshot/locate";

/**
 * Zero-touch addon installation. When Nirnside runs on the same PC as ESO, we
 * copy (and keep updated) our own addons into every ESO AddOns folder we find,
 * so the user never has to move files by hand. Read-only toward the game
 * otherwise: we only write our own addon folders, never touch other addons or
 * game settings, and every step is guarded so it can never crash startup.
 */

const ADDONS = ["NirnsideSnapshot", "NirnsideCatalog"] as const;

export interface AddonInstallResult {
  addOnsDirs: string[];
  installed: string[]; // "Addon -> dir"
  updated: string[];
  upToDate: string[];
  errors: string[];
}

function sourceDir(addon: string): string {
  return join(process.cwd(), "addon", addon);
}

/** Read the `## Version:` line from an addon manifest, or null. */
function manifestVersion(txtPath: string): string | null {
  try {
    const m = readFileSync(txtPath, "utf8").match(/^##\s*Version:\s*(.+)$/im);
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

/** Every ESO AddOns directory we can find (creating it under a real env dir). */
export function findAddOnsDirs(): string[] {
  const dirs: string[] = [];
  for (const root of esoRoots()) {
    for (const env of envFolders(root)) {
      const addOns = join(root, env, "AddOns");
      if (existsSync(addOns)) {
        dirs.push(addOns);
      } else if (existsSync(join(root, env))) {
        // The env exists (real ESO install) but no AddOns folder yet — safe to create.
        try {
          mkdirSync(addOns, { recursive: true });
          dirs.push(addOns);
        } catch {
          /* ignore */
        }
      }
    }
  }
  return Array.from(new Set(dirs));
}

export function installAddons(): AddonInstallResult {
  const result: AddonInstallResult = { addOnsDirs: [], installed: [], updated: [], upToDate: [], errors: [] };
  const dirs = findAddOnsDirs();
  result.addOnsDirs = dirs;
  if (dirs.length === 0) return result;

  for (const addon of ADDONS) {
    const src = sourceDir(addon);
    if (!existsSync(src)) continue;
    const srcVer = manifestVersion(join(src, `${addon}.txt`));

    for (const dir of dirs) {
      const dest = join(dir, addon);
      try {
        const existed = existsSync(dest);
        const destVer = existed ? manifestVersion(join(dest, `${addon}.txt`)) : null;
        // Always copy. A matching Version: line used to skip, which left missing
        // files (e.g. Bindings.xml) and no "modified today" on disk.
        cpSync(src, dest, { recursive: true });
        if (!existed) {
          result.installed.push(`${addon} ${srcVer ?? "?"} -> ${dir}`);
        } else if (destVer === srcVer && srcVer !== null) {
          result.upToDate.push(`${addon} ${srcVer} -> ${dir}`);
        } else {
          result.updated.push(`${addon} ${destVer ?? "?"} → ${srcVer ?? "?"} -> ${dir}`);
        }
      } catch (err) {
        result.errors.push(`${addon} -> ${dir}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return result;
}
