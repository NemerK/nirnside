import { getDb, setMeta } from "../db";
import { CatalogBundle, SOURCE_RANK, type CatalogDomain } from "./schema";

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
export function importCatalogBundle(raw: unknown): Record<string, number> {
  const bundle = CatalogBundle.parse(raw);
  const db = getDb();

  const rows: Row[] = [];
  const push = (
    domain: CatalogDomain,
    e: { id: string; name: string; source: string; patch: string },
    category: string | null,
    subcategory: string | null,
  ) => rows.push({ domain, id: e.id, name: e.name, category, subcategory, source: e.source, patch: e.patch, json: JSON.stringify(e) });

  for (const s of bundle.sets) push("set", s, s.category, s.dlc);
  for (const l of bundle.skillLines) push("skillline", l, l.category, l.className);
  for (const s of bundle.skills) push("skill", s, s.lineId, s.type);
  for (const c of bundle.cp) push("cp", c, c.category, c.type);
  for (const g of bundle.grimoires) push("grimoire", g, g.skillLine, null);
  for (const s of bundle.scripts) push("script", s, s.slot, null);
  for (const a of bundle.achievements) push("achievement", a, a.category, a.subtype);

  const stmt = db.prepare(`
    INSERT INTO catalog (domain, id, name, category, subcategory, source, patch, json)
    VALUES (@domain, @id, @name, @category, @subcategory, @source, @patch, @json)
    ON CONFLICT(domain, id) DO UPDATE SET
      name = excluded.name,
      category = excluded.category,
      subcategory = excluded.subcategory,
      source = excluded.source,
      patch = excluded.patch,
      json = excluded.json
    WHERE (CASE excluded.source WHEN 'ingame' THEN 3 WHEN 'community' THEN 2 ELSE 1 END)
       >= (CASE catalog.source  WHEN 'ingame' THEN 3 WHEN 'community' THEN 2 ELSE 1 END)
  `);

  const counts: Record<string, number> = {};
  const tx = db.transaction((all: Row[]) => {
    for (const r of all) {
      stmt.run(r);
      counts[r.domain] = (counts[r.domain] ?? 0) + 1;
    }
  });
  tx(rows);

  // Record the highest-precedence source present, for UI honesty.
  const prev = (getCatalogMeta()?.source ?? "reference") as keyof typeof SOURCE_RANK;
  const incoming = bundle.source;
  const bestSource = SOURCE_RANK[incoming] >= SOURCE_RANK[prev] ? incoming : prev;
  setMeta("catalog", { patch: bundle.patch, source: bestSource, updatedAt: Date.now() });

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
