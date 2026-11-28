import type { Database } from "better-sqlite3";
import { skillLineId } from "../game/skills";
import { mergeEntry } from "./import";
import { SOURCE_RANK, type CatalogSource } from "./schema";

interface StoredRow {
  id: string;
  source: string;
  patch: string;
  name: string;
  json: string;
}

const rank = (s: string) => SOURCE_RANK[s as CatalogSource] ?? 1;

/**
 * Fold every skill line stored under another id into its one id
 * (game/skills.ts skillLineId), and move its abilities with it.
 *
 * Why: the catalog never forgets, so rows an older addon filed under a
 * different id stayed forever as a second copy of the line, without its
 * class ("line-dawn-s-wrath" beside "line-dawns-wrath"), and every page that
 * listed class lines showed it in a classless "Class" group. Imports now file
 * lines under one id; this repairs what is already stored. Idempotent: a
 * clean catalog is left as it is.
 *
 * Merge rule, per field: the higher-ranked source's value wins, the other
 * fills its gaps (the seed's class stays when a scan sent none). A Class
 * Mastery row with no class has no id at all and is dropped, with its
 * abilities: the seed holds each class's own tree.
 */
export function healSkillLineIds(db: Database): { folded: number; dropped: number } {
  let folded = 0;
  let dropped = 0;
  const rows = db.prepare("SELECT id, source, patch, name, json FROM catalog WHERE domain = 'skillline'").all() as StoredRow[];
  const get = db.prepare("SELECT id, source, patch, name, json FROM catalog WHERE domain = 'skillline' AND id = ?");
  const put = db.prepare(
    `INSERT OR REPLACE INTO catalog (domain, id, name, category, subcategory, source, patch, json)
     VALUES ('skillline', @id, @name, @category, @subcategory, @source, @patch, @json)`,
  );
  const del = db.prepare("DELETE FROM catalog WHERE domain = 'skillline' AND id = ?");
  const skillsOf = db.prepare("SELECT id, json FROM catalog WHERE domain = 'skill' AND category = ?");
  const moveSkill = db.prepare("UPDATE catalog SET category = ?, json = ? WHERE domain = 'skill' AND id = ?");
  const dropSkills = db.prepare("DELETE FROM catalog WHERE domain = 'skill' AND category = ?");

  const tx = db.transaction(() => {
    for (const row of rows) {
      const entry = JSON.parse(row.json) as Record<string, unknown>;
      const target = skillLineId(String(entry.name ?? row.name), (entry.className as string | null) ?? null);
      if (target === row.id) continue;
      if (!target) {
        del.run(row.id);
        dropSkills.run(row.id);
        dropped += 1;
        continue;
      }
      const existing = get.get(target) as StoredRow | undefined;
      let merged: Record<string, unknown> = { ...entry, id: target };
      let source = row.source;
      let patch = row.patch;
      if (existing) {
        const there = JSON.parse(existing.json) as Record<string, unknown>;
        const strayWins = rank(row.source) > rank(existing.source);
        merged = { ...(strayWins ? mergeEntry(there, entry) : mergeEntry(entry, there)), id: target };
        source = strayWins ? row.source : existing.source;
        patch = strayWins ? row.patch : existing.patch;
      }
      put.run({
        id: target,
        name: String(merged.name ?? row.name),
        category: (merged.category as string | null) ?? null,
        subcategory: (merged.className as string | null) || null,
        source,
        patch,
        json: JSON.stringify(merged),
      });
      del.run(row.id);
      for (const s of skillsOf.all(row.id) as { id: string; json: string }[]) {
        const skill = JSON.parse(s.json) as Record<string, unknown>;
        moveSkill.run(target, JSON.stringify({ ...skill, lineId: target }), s.id);
      }
      folded += 1;
    }
    // A scan may have blanked a line's class column before imports merged columns; restore it from the entry.
    db.prepare(
      `UPDATE catalog SET subcategory = json_extract(json, '$.className')
       WHERE domain = 'skillline' AND json_extract(json, '$.className') IS NOT NULL
         AND (subcategory IS NULL OR subcategory != json_extract(json, '$.className'))`,
    ).run();
  });
  tx();
  return { folded, dropped };
}
