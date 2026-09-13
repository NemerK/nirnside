import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { importCatalogBundle } from "./import";
import { parseLua, type LuaValue } from "../snapshot/lua-parser";

const CATALOG_DIR = join(process.cwd(), "data", "catalog");

/**
 * Load the bundled reference catalog (data/catalog/*.json). These are tagged
 * `reference` and will never overwrite in-game-verified data thanks to source
 * precedence in the importer. Safe to run on every startup.
 */
export function loadReferenceCatalog(): { files: number; counts: Record<string, number> } {
  if (!existsSync(CATALOG_DIR)) return { files: 0, counts: {} };
  const files = readdirSync(CATALOG_DIR).filter((f) => f.endsWith(".json"));
  const total: Record<string, number> = {};
  for (const file of files) {
    try {
      const raw = JSON.parse(readFileSync(join(CATALOG_DIR, file), "utf8"));
      const counts = importCatalogBundle(raw);
      for (const [k, v] of Object.entries(counts)) total[k] = (total[k] ?? 0) + v;
    } catch (err) {
      console.error(`[nirnside] catalog seed ${file} failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { files: files.length, counts: total };
}

/**
 * Load an in-game catalog dump produced by the NirnsideCatalog addon. This is
 * the authoritative, in-game-verified source and overrides reference data.
 * Expected shape mirrors the JSON bundle, under a NirnsideCatalog Lua variable.
 */
export function loadCatalogFromLua(path: string): Record<string, number> {
  const program = parseLua(readFileSync(path, "utf8"));
  const root = program["NirnsideCatalog"] ?? program["NirnsideCatalogData"];
  const payload = unwrap(root);
  if (!payload) throw new Error("NirnsideCatalog table not found in dump");
  // Force in-game source regardless of what the file claims.
  const bundle = { ...(payload as Record<string, unknown>), source: "ingame" };
  return importCatalogBundle(bundle);
}

function unwrap(node: LuaValue | undefined): Record<string, LuaValue> | null {
  if (!node || typeof node !== "object" || Array.isArray(node)) return null;
  // Support either a flat bundle or ZO_SavedVars account-wide nesting.
  if ("Default" in node) {
    const def = node["Default"];
    if (def && typeof def === "object" && !Array.isArray(def)) {
      const acct = Object.keys(def).find((k) => k.startsWith("@"));
      if (acct) {
        const a = (def as Record<string, LuaValue>)[acct];
        if (a && typeof a === "object" && !Array.isArray(a)) {
          const aw = (a as Record<string, LuaValue>)["$AccountWide"];
          if (aw && typeof aw === "object" && !Array.isArray(aw)) return aw as Record<string, LuaValue>;
        }
      }
    }
  }
  return node as Record<string, LuaValue>;
}
