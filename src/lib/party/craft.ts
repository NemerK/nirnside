import { canonicalTrait } from "../game/traits";
import type { CharacterResearch } from "../snapshot/schema";

/**
 * Who can craft a piece of a crafted set. A crafted set needs a number of
 * traits researched on that item (Axe, Helm, Robe…); a trait can only be put
 * on the piece once it is researched too. This reads only the research the
 * game reported — nothing is assumed for a line the snapshot doesn't list.
 */

export interface CraftCandidate {
  id: string;
  name: string;
  className: string;
  /** Traits known on this item line. */
  known: number;
  /** Whether the asked-for trait is researched on this line. Null when no trait was asked for. */
  hasTrait: boolean | null;
}

export interface CraftRow {
  craft: string;
  line: string;
  /** Characters who can make it now, most traits first. */
  can: CraftCandidate[];
  /** The closest character who can't yet, and how many traits they still need. */
  closest: (CraftCandidate & { missing: number }) | null;
  /** Every character the snapshot has research for on this piece, by id. */
  cells: Record<string, CraftCell>;
}

export interface CraftCell {
  known: number;
  hasTrait: boolean | null;
  ok: boolean;
  /** Traits still to research before this character can make it (counting the asked-for trait). */
  missing: number;
}

/** Per character: how many of the set's pieces they can make now. */
export function craftCoverage(rows: CraftRow[], ids: string[]): Map<string, { ok: number; total: number }> {
  const out = new Map<string, { ok: number; total: number }>();
  for (const id of ids) {
    let ok = 0;
    let total = 0;
    for (const r of rows) {
      const cell = r.cells[id];
      if (!cell) continue;
      total += 1;
      if (cell.ok) ok += 1;
    }
    out.set(id, { ok, total });
  }
  return out;
}

export interface CraftSource {
  id: string;
  name: string;
  className: string;
  research: CharacterResearch;
}

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function whoCanCraft(characters: CraftSource[], traitsNeeded: number, trait: string | null): CraftRow[] {
  const rows = new Map<string, CraftRow>();
  for (const c of characters) {
    for (const craft of c.research.crafts) {
      for (const line of craft.lines) {
        const key = `${craft.name}|${line.name}`;
        let row = rows.get(key);
        if (!row) {
          row = { craft: craft.name || craft.craft, line: line.name, can: [], closest: null, cells: {} };
          rows.set(key, row);
        }
        const known = line.traits.filter((t) => t.known).length;
        // Trait names compared through the game model ("Well-Fitted", "Armor Well-fitted").
        const wanted = trait ? (canonicalTrait(trait) ?? trait) : null;
        const traitRow = wanted ? line.traits.find((t) => same(canonicalTrait(t.name) ?? t.name, wanted)) : undefined;
        const hasTrait = trait ? (traitRow ? traitRow.known : false) : null;
        const candidate: CraftCandidate = { id: c.id, name: c.name, className: c.className, known, hasTrait };
        const ok = known >= traitsNeeded && hasTrait !== false;
        row.cells[c.id] = {
          known,
          hasTrait,
          ok,
          missing: ok ? 0 : Math.max(0, traitsNeeded - known) + (hasTrait === false ? 1 : 0),
        };
        if (ok) {
          row.can.push(candidate);
        } else {
          const missing = Math.max(0, traitsNeeded - known) + (hasTrait === false ? 1 : 0);
          if (!row.closest || missing < row.closest.missing) row.closest = { ...candidate, missing };
        }
      }
    }
  }
  for (const row of rows.values()) {
    row.can.sort((a, b) => b.known - a.known || a.name.localeCompare(b.name));
    if (row.can.length > 0) row.closest = null;
  }
  return [...rows.values()];
}
