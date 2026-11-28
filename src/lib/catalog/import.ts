import { getDb, setMeta } from "../db";
import { CatalogBundle, SOURCE_RANK, type CatalogDomain, type CatalogSource } from "./schema";
import { isExcludedCatalogLineId, isExcludedSkillLine } from "../game/vengeance";
import { catalogId } from "../game/catalog-ids";
import { columnsOf, mergeEntry } from "./merge";
import { healCatalog } from "./heal";

type CatalogSourceKey = CatalogSource;

type Row = {
  domain: CatalogDomain;
  id: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  source: string;
  patch: string;
  json: string;
};

/**
 * Upsert a catalog bundle. Source precedence is enforced in SQL: an incoming row
 * only overwrites an existing one when its source rank (ingame > community >
 * reference) is at least as high. This is the accuracy rule as code — an in-game
 * scan can never be clobbered by reference seed data.
 */
export function importCatalogBundle(
  raw: unknown,
  opts: { /** False for facts learned outside a catalog scan, so the scan's patch label stays. */ touchMeta?: boolean } = {},
): Record<string, number> {
  const bundle = CatalogBundle.parse(raw);
  const db = getDb();

  const rows: Row[] = [];
  // Every entry is filed under its one id (game/catalog-ids.ts), whatever id
  // the scan or seed sent. An entry with no id (Class Mastery without its
  // class) is left out: the seed has each class's tree.
  const push = (
    domain: CatalogDomain,
    e: { id: string; name: string; source: string; patch: string; className?: string | null },
    category: string | null,
    subcategory: string | null,
  ) => {
    const id = catalogId(domain, e);
    if (!id) return;
    const filed = { ...e, id };
    // An entry carries the patch of the scan or seed it came in, unless it names its own.
    const patch = e.patch || bundle.patch;
    rows.push({ domain, id, name: e.name, category, subcategory, source: e.source, patch, json: JSON.stringify({ ...filed, patch }) });
  };

  // Vengeance lines never enter the catalog, nor do abilities filed under them.
  const excludedIds = new Set<string>();
  // Abilities follow their line to its one id.
  const lineIdOf = new Map<string, string | null>();
  for (const s of bundle.sets) push("set", s, s.category, s.dlc);
  for (const l of bundle.skillLines) {
    if (isExcludedSkillLine(l)) {
      excludedIds.add(l.id.toLowerCase());
      continue;
    }
    lineIdOf.set(l.id, catalogId("skillline", l));
    push("skillline", l, l.category, l.className);
  }
  for (const s of bundle.skills) {
    if (isExcludedCatalogLineId(s.lineId) || excludedIds.has(s.lineId.toLowerCase())) continue;
    const lineId = lineIdOf.has(s.lineId) ? lineIdOf.get(s.lineId) : s.lineId;
    if (!lineId) continue;
    const filed: typeof s = { ...s, lineId };
    push("skill", filed, lineId, s.type);
  }
  for (const c of bundle.cp) push("cp", c, c.category, c.type);
  for (const g of bundle.grimoires) push("grimoire", g, g.skillLine, null);
  for (const s of bundle.scripts) push("script", s, s.slot, null);
  for (const a of bundle.achievements) push("achievement", a, a.category, a.subtype);
  for (const m of bundle.mundus) push("mundus", m, null, null);
  for (const f of bundle.food) push("food", f, f.kind, f.recipeList || null);
  for (const r of bundle.recipes) push("recipe", r, r.kind, r.craft);

  const selectStmt = db.prepare("SELECT source, json FROM catalog WHERE domain = ? AND id = ?");
  const upsertStmt = db.prepare(`
    INSERT OR REPLACE INTO catalog (domain, id, name, category, subcategory, source, patch, json)
    VALUES (@domain, @id, @name, @category, @subcategory, @source, @patch, @json)
  `);

  const rank = (s: string) => SOURCE_RANK[(s as CatalogSourceKey)] ?? 1;

  const counts: Record<string, number> = {};
  const tx = db.transaction((all: Row[]) => {
    for (const r of all) {
      const existing = selectStmt.get(r.domain, r.id) as { source: string; json: string } | undefined;
      if (existing && rank(r.source) < rank(existing.source)) continue; // lower precedence: keep existing

      let row = r;
      if (existing) {
        // Field-level merge: incoming (higher/equal precedence) wins per field,
        // but keeps existing values where incoming is empty/absent. This lets a
        // partial in-game scan upgrade entries without dropping reference detail.
        const prev = JSON.parse(existing.json) as Record<string, unknown>;
        const next = JSON.parse(r.json) as Record<string, unknown>;
        const merged = mergeEntry(prev, next);
        // The indexed columns come from the merged entry, so a scan that left a
        // field empty (a class line's class) can't blank the column either.
        row = { ...r, json: JSON.stringify(merged), ...columnsOf(r.domain, merged, r) };
      }

      upsertStmt.run(row);
      counts[r.domain] = (counts[r.domain] ?? 0) + 1;
    }
  });
  tx(rows);

  // Fold anything stored under another id, and correct what the game has since shown wrong.
  healCatalog(db);

  if (opts.touchMeta === false) return counts;
  // Record the highest-precedence source present, for UI honesty.
  const prev = (getCatalogMeta()?.source ?? "reference") as keyof typeof SOURCE_RANK;
  const incoming = bundle.source;
  // The label describes the best source present: a seed loaded after a scan doesn't relabel the scan's patch.
  if (SOURCE_RANK[incoming] >= SOURCE_RANK[prev]) {
    setMeta("catalog", { patch: bundle.patch, source: incoming, updatedAt: Date.now() });
  }

  return counts;
}

export interface CatalogMeta {
  patch: string;
  source: string;
  updatedAt: number;
}

export function getCatalogMeta(): CatalogMeta | null {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = 'catalog'").get() as
    | { value: string }
    | undefined;
  return row ? (JSON.parse(row.value) as CatalogMeta) : null;
}

/**
 * Fill catalog recipes that lack ingredients with the ones a character's
 * save carries (recipeIngredientsFromCharacters). Only ingredients change,
 * and only where the catalog has none, so a scan's own stay as they are.
 */
export function fillRecipeIngredients(
  learned: ReadonlyMap<number, { itemId?: number | null; name: string; quantity: number; quality?: number | null }[]>,
): number {
  if (learned.size === 0) return 0;
  const db = getDb();
  const select = db.prepare("SELECT json FROM catalog WHERE domain = 'recipe' AND id = ?");
  const update = db.prepare("UPDATE catalog SET json = ? WHERE domain = 'recipe' AND id = ?");
  let filled = 0;
  db.transaction(() => {
    for (const [itemId, ingredients] of learned) {
      const id = `recipe-${itemId}`;
      const row = select.get(id) as { json: string } | undefined;
      if (!row) continue;
      const entry = JSON.parse(row.json) as { ingredients?: { name?: string; quantity?: number }[] };
      const named = (entry.ingredients ?? []).filter((i) => i.name && (i.quantity ?? 0) > 0);
      if (named.length > 0) continue;
      update.run(JSON.stringify({ ...entry, ingredients }), id);
      filled += 1;
    }
  })();
  return filled;
}
