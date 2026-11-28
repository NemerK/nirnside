import "server-only";
import { classLineMap } from "../game/classes";
import { getMundus, getSkillLines, getSkills } from "./catalog-queries";
import type { MundusText } from "../game/mundus";

/** Class → its skill lines, from the game catalog (the in-game scan wins over shipped reference data). */
export function classLines(): Map<string, string[]> {
  try {
    return classLineMap(getSkillLines().map(({ entry }) => ({ name: entry.name, className: entry.className })));
  } catch {
    return new Map();
  }
}

/**
 * Ability (base or morph) → its skill line, from the game catalog. Used to
 * tell which weapon a slotted ability needs.
 */
export function abilityLines(): Map<string, string> {
  const out = new Map<string, string>();
  try {
    const lineName = new Map(getSkillLines().map(({ entry }) => [entry.id, entry.name]));
    for (const { entry } of getSkills()) {
      const line = lineName.get(entry.lineId);
      if (!line) continue;
      out.set(entry.name.trim().toLowerCase(), line);
      for (const m of entry.morphs) if (m.name) out.set(m.name.trim().toLowerCase(), line);
    }
  } catch {
    // no catalog yet
  }
  return out;
}

/** Each Mundus blessing's text as the game wrote it, for readCharacter. */
export function mundusTexts(): MundusText[] {
  try {
    return getMundus().map(({ entry }) => ({ name: entry.name, description: entry.description, effects: entry.effects }));
  } catch {
    return [];
  }
}
