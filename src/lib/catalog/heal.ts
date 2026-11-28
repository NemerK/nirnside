import type { Database } from "better-sqlite3";
import { catalogId } from "../game/catalog-ids";
import { findConstellation } from "../game/champion";
import { columnsOf, mergeEntry } from "./merge";
import { CatalogDomain, SOURCE_RANK, type CatalogSource } from "./schema";

interface StoredRow {
  domain: CatalogDomain;
  id: string;
  source: string;
  patch: string;
  name: string;
  category: string | null;
  subcategory: string | null;
  json: string;
}

const rank = (s: string) => SOURCE_RANK[s as CatalogSource] ?? 1;

/**
 * Keep the catalog one row per thing, and correct what the game has shown
 * to be wrong. Runs after every catalog import (seed or scan), so it also
 * repairs a database written by an older version. Idempotent: a clean
 * catalog is left as it is.
 */
export function healCatalog(db: Database): { folded: number; dropped: number; relabelled: number } {
  const ids = foldIds(db);
  const relabelled = correctConstellations(db);
  return { ...ids, relabelled };
}

/**
 * Fold every row stored under another id into its one id
 * (game/catalog-ids.ts), and move a line's abilities with it.
 *
 * Why: the catalog never forgets, so every id an older addon or seed built
 * differently ("line-dawn-s-wrath", "set-mother-s-sorrow", "cp-fitness-…")
 * stayed beside the right one as a second copy of the same thing.
 *
 * Merge rule, per field: the higher-ranked source's value wins, the other
 * fills its gaps. A row with no id (Class Mastery without a class) is
 * dropped with its abilities: the seed holds each class's own tree.
 */
function foldIds(db: Database): { folded: number; dropped: number } {
  let folded = 0;
  let dropped = 0;
  // Lines first, so their abilities move with them before abilities are folded on their own.
  const rows = db
    .prepare("SELECT domain, id FROM catalog ORDER BY CASE domain WHEN 'skillline' THEN 0 ELSE 1 END")
    .all() as Pick<StoredRow, "domain" | "id">[];
  const get = db.prepare("SELECT domain, id, source, patch, name, category, subcategory, json FROM catalog WHERE domain = ? AND id = ?");
  const put = db.prepare(
    `INSERT OR REPLACE INTO catalog (domain, id, name, category, subcategory, source, patch, json)
     VALUES (@domain, @id, @name, @category, @subcategory, @source, @patch, @json)`,
  );
  const del = db.prepare("DELETE FROM catalog WHERE domain = ? AND id = ?");
  const skillsOf = db.prepare("SELECT id, json FROM catalog WHERE domain = 'skill' AND category = ?");
  const moveSkill = db.prepare("UPDATE catalog SET category = ?, json = ? WHERE domain = 'skill' AND id = ?");
  const dropSkills = db.prepare("DELETE FROM catalog WHERE domain = 'skill' AND category = ?");

  db.transaction(() => {
    for (const listed of rows) {
      // Read it again: an earlier fold this pass may have moved or changed it.
      const row = get.get(listed.domain, listed.id) as StoredRow | undefined;
      if (!row) continue;
      const domain = CatalogDomain.safeParse(row.domain);
      if (!domain.success) continue;
      const entry = JSON.parse(row.json) as Record<string, unknown>;
      const target = catalogId(domain.data, {
        id: row.id,
        name: String(entry.name ?? row.name),
        className: (entry.className as string | null) ?? null,
      });
      if (target === row.id) continue;
      if (!target) {
        del.run(row.domain, row.id);
        if (row.domain === "skillline") dropSkills.run(row.id);
        dropped += 1;
        continue;
      }
      // The row may have been folded already this pass; read what's there now.
      const existing = get.get(row.domain, target) as StoredRow | undefined;
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
        domain: row.domain,
        id: target,
        name: String(merged.name ?? row.name),
        ...columnsOf(domain.data, merged, { category: row.category, subcategory: row.subcategory }),
        source,
        patch,
        json: JSON.stringify(merged),
      });
      del.run(row.domain, row.id);
      if (row.domain === "skillline") {
        for (const s of skillsOf.all(row.id) as { id: string; json: string }[]) {
          const skill = JSON.parse(s.json) as Record<string, unknown>;
          moveSkill.run(target, JSON.stringify({ ...skill, lineId: target }), s.id);
        }
      }
      folded += 1;
    }
    // A scan may have blanked a line's class column before imports merged columns; restore it from the entry.
    db.prepare(
      `UPDATE catalog SET subcategory = json_extract(json, '$.className')
       WHERE domain = 'skillline' AND json_extract(json, '$.className') IS NOT NULL
         AND (subcategory IS NULL OR subcategory != json_extract(json, '$.className'))`,
    ).run();
  })();
  return { folded, dropped };
}

/**
 * Put every Champion star under its real constellation, with its real type.
 *
 * Why: before Catalog 0.2.7 the catalog addon listed each constellation's
 * stars by its id instead of its position, so every star was filed under
 * another constellation (Deadly Aim, a Warfare star, as Fitness). The
 * snapshot addon always read them right, so the characters' saves are the
 * game's own word on where a star belongs; the seed's rows agree with them.
 *
 * - A star a save (or the seed) places is moved there.
 * - A star nothing places is moved only when the evidence for its stored
 *   constellation agrees unanimously (at least five stars) on where that
 *   constellation's stars really belong. A fixed scan agrees with itself, so
 *   this changes nothing once the catalog is right.
 */
function correctConstellations(db: Database): number {
  const truth = new Map<string, string>();
  // Slottable, passive or cluster, as a save read it (CanChampionSkillTypeBeSlotted).
  const kindOf = new Map<string, string>();
  const say = (name: string, constellation: string | null | undefined) => {
    const c = findConstellation(constellation);
    if (c) truth.set(name.trim().toLowerCase(), c);
  };
  for (const r of db.prepare("SELECT json FROM catalog WHERE domain = 'cp' AND source = 'reference'").all() as { json: string }[]) {
    const e = JSON.parse(r.json) as { name: string; category: string };
    say(e.name, e.category);
  }
  // Saves outrank the seed.
  let saves: { json: string }[] = [];
  try {
    saves = db.prepare("SELECT json FROM characters").all() as { json: string }[];
  } catch {
    saves = [];
  }
  for (const r of saves) {
    const c = JSON.parse(r.json) as { champion?: { name: string; stars?: { name: string; kind?: string }[] }[] };
    for (const d of c.champion ?? []) {
      for (const s of d.stars ?? []) {
        say(s.name, d.name);
        if (s.kind === "slottable" || s.kind === "passive" || s.kind === "cluster") kindOf.set(s.name.trim().toLowerCase(), s.kind);
      }
    }
  }

  const stars = (db.prepare("SELECT id, source, json FROM catalog WHERE domain = 'cp'").all() as { id: string; source: string; json: string }[]).map(
    (r) => ({ id: r.id, scanned: r.source === "ingame", entry: JSON.parse(r.json) as Record<string, unknown> & { name: string; category: string } }),
  );
  // Where each stored constellation's scanned stars really are, by the evidence.
  // Only scanned rows count: the scan is what mislabelled, the seed didn't.
  const evidence = new Map<string, Map<string, number>>();
  for (const s of stars) {
    if (!s.scanned) continue;
    const stored = findConstellation(s.entry.category);
    const real = truth.get(s.entry.name.trim().toLowerCase());
    if (!stored || !real) continue;
    const m = evidence.get(stored) ?? new Map<string, number>();
    m.set(real, (m.get(real) ?? 0) + 1);
    evidence.set(stored, m);
  }
  const unanimous = new Map<string, string>();
  for (const [stored, m] of evidence) {
    if (m.size === 1) {
      const [[real, n]] = [...m.entries()];
      if (n >= 5) unanimous.set(stored, real);
    }
  }

  const fix = db.prepare("UPDATE catalog SET category = ?, json = ? WHERE domain = 'cp' AND id = ?");
  let moved = 0;
  db.transaction(() => {
    for (const s of stars) {
      const stored = findConstellation(s.entry.category);
      const key = s.entry.name.trim().toLowerCase();
      const real = truth.get(key) ?? (s.scanned && stored ? unanimous.get(stored) : undefined) ?? stored;
      // Before Catalog 0.2.7 every scanned star was stored as passive; a save knows better.
      const kind = kindOf.get(key) ?? (s.entry.type as string | undefined);
      if (real === stored && kind === s.entry.type) continue;
      fix.run(real ?? s.entry.category, JSON.stringify({ ...s.entry, category: real ?? s.entry.category, type: kind }), s.id);
      moved += 1;
    }
  })();
  return moved;
}
