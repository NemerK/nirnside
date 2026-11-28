import type { Character } from "../snapshot/schema";
import { catalogSlug } from "./catalog-ids";

/**
 * Facts about the game itself that a character's save carries, turned into
 * catalog rows, so Nirnside learns them without a catalog scan. Only what
 * the game wrote is used.
 *
 * - Mundus: a saved blessing buff carries the game's own text with this
 *   patch's numbers ("Boon: The Warrior"). Its id matches the catalog
 *   scan's ("mundus-" + slug), so either source fills the same row.
 */

export interface LearnedBlessing {
  id: string;
  /** The game's API version at the save, as the catalog labels patches ("API101047"). */
  patch: string;
  name: string;
  abilityId: number | null;
  description: string;
  icon: string | null;
  source: "ingame";
}

export function blessingsFromCharacters(characters: readonly Character[], patch = "live"): LearnedBlessing[] {
  const out = new Map<string, LearnedBlessing>();
  // Oldest save first, so the most recently saved character's text wins.
  const bySave = [...characters].sort((a, b) => (a.lastSeen ?? 0) - (b.lastSeen ?? 0));
  for (const c of bySave) {
    for (const b of c.buffs ?? []) {
      if (!b.mundus || !b.description) continue;
      const name = b.name.replace(/^boon:\s*/i, "").trim();
      if (!name) continue;
      const id = `mundus-${catalogSlug(name)}`;
      out.set(id, { id, patch, name, abilityId: b.abilityId ?? null, description: b.description, icon: b.icon ?? null, source: "ingame" });
    }
  }
  return [...out.values()];
}
