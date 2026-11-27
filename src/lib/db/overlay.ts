import "server-only";
import { getDb } from "./index";
import { getCharactersFull } from "./queries";
import { abilityIsKnown, displayAbility, knownAbilityNames, romanRank } from "../skills/ability";

/** How much of a set the account owns: inventory stacks + stickerbook progress. */
export function setOwnership(setName: string): {
  inventoryCount: number;
  sticker: { collected: number; total: number } | null;
} {
  // Deleted characters' bags never reach the database (snapshot/roster.ts withoutDeletedCharacters).
  const inventoryCount = (
    getDb().prepare("SELECT COUNT(*) AS n FROM items WHERE setName = ? COLLATE NOCASE").get(setName) as { n: number }
  ).n;
  const sb = getDb()
    .prepare("SELECT collected, total FROM stickerbook WHERE name = ? COLLATE NOCASE")
    .get(setName) as { collected: number; total: number } | undefined;
  return { inventoryCount, sticker: sb ? { collected: sb.collected, total: sb.total } : null };
}

export interface CharRef {
  id: string;
  name: string;
  detail?: string;
}

/** Characters that have discovered a given skill line, with their rank. */
export function charactersWithSkillLine(lineName: string): CharRef[] {
  const out: CharRef[] = [];
  for (const c of getCharactersFull()) {
    const line = c.skillLines.find((l) => l.name.toLowerCase() === lineName.toLowerCase());
    if (line) out.push({ id: c.id, name: c.name, detail: `Rank ${line.rank}` });
  }
  return out;
}

/** Characters that have a given ability or morph (by name) purchased/known. */
export function charactersKnowingSkill(names: string[]): CharRef[] {
  const lc = names.map((n) => n.toLowerCase());
  const out: CharRef[] = [];
  for (const c of getCharactersFull()) {
    for (const line of c.skillLines) {
      const hit = line.abilities.find((a) => {
        if (!abilityIsKnown(a)) return false;
        return knownAbilityNames(a).some((n) => lc.includes(n.toLowerCase()));
      });
      if (hit) {
        const face = displayAbility(hit);
        const rank = face.showingMorph
          ? hit.morphs.find((m) => m.slot === face.morphSlot)?.rank
          : (hit.morphs.find((m) => m.slot === 0)?.rank ?? (hit.rank > 0 ? hit.rank : null));
        const rankLabel = rank ? ` ${romanRank(rank)}` : "";
        out.push({
          id: c.id,
          name: c.name,
          detail: face.showingMorph ? `${face.name}${rankLabel}` : rankLabel.trim() || undefined,
        });
        break;
      }
    }
  }
  return out;
}

/** CP points spent on a given star, across all characters. */
export function cpAcross(starName: string): CharRef[] {
  const out: CharRef[] = [];
  for (const c of getCharactersFull()) {
    for (const disc of c.champion) {
      const star = disc.stars.find((s) => s.name.toLowerCase() === starName.toLowerCase());
      if (star) {
        out.push({ id: c.id, name: c.name, detail: `${star.points} pts${star.slotted ? " · slotted" : ""}` });
        break;
      }
    }
  }
  return out;
}

/** Every scribing script known across the account (by name, lowercased). */
export function knownScriptNames(): Set<string> {
  const set = new Set<string>();
  for (const c of getCharactersFull()) {
    for (const s of c.scribingScripts) set.add(s.toLowerCase());
  }
  return set;
}

/** Characters that know a given scribing script. */
export function charactersWithScript(scriptName: string): CharRef[] {
  const out: CharRef[] = [];
  for (const c of getCharactersFull()) {
    if (c.scribingScripts.some((s) => s.toLowerCase() === scriptName.toLowerCase())) {
      out.push({ id: c.id, name: c.name });
    }
  }
  return out;
}
