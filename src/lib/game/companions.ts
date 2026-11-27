/**
 * Companions (Update 30, 2021). Sources: UESP Online:Rapport and the ZOS
 * "Companions System Guide".
 *
 * - NPC allies that fight beside a character, level 1 to 20 from combat
 *   experience. Their progress, skill lines, bar and gear are shared by
 *   every character on the account.
 * - One ability bar: five abilities and an ultimate (the ultimate slot
 *   opens at level 20). Abilities cost no skill points and never rank up
 *   or morph.
 * - Skill lines: their own three class lines (themed on a player class),
 *   weapon lines (from the weapons they carry), armor lines (only while
 *   wearing five or more pieces of that weight), guild lines (from those
 *   guilds' dailies), and a racial line with no actives.
 * - Companion gear is its own item category, with its own traits.
 * - Rapport (from hate to love) changes their dialogue and quests, not
 *   their fighting.
 */

export const COMPANION_MAX_LEVEL = 20;
export const COMPANION_ULTIMATE_LEVEL = 20;
export const COMPANION_BAR_SLOTS = 5;
/** Body pieces of one weight a companion must wear for that armor line to level. */
export const COMPANION_ARMOR_LINE_PIECES = 5;

/** The player class each companion's class lines are themed on (UESP Online:Rapport). */
export const COMPANION_THEME: Record<string, string> = {
  Bastian: "Dragonknight",
  Mirri: "Nightblade",
  Ember: "Sorcerer",
  Isobel: "Templar",
  Azandar: "Arcanist",
  "Sharp-as-Night": "Warden",
};

export interface CompanionReading {
  name: string;
  level: number;
  maxed: boolean;
  ultimateOpen: boolean;
  rapport: string | null;
  theme: string | null;
}

export function readCompanion(c: { name: string; level?: number | null; rapport?: string | null }): CompanionReading {
  const level = c.level ?? 0;
  const theme = Object.entries(COMPANION_THEME).find(([n]) => c.name.toLowerCase().startsWith(n.toLowerCase()))?.[1] ?? null;
  return {
    name: c.name,
    level,
    maxed: level >= COMPANION_MAX_LEVEL,
    ultimateOpen: level >= COMPANION_ULTIMATE_LEVEL,
    rapport: c.rapport ?? null,
    theme,
  };
}
