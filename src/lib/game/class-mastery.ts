/**
 * Update 50 Class Mastery — a per-class skill line of five passives.
 *
 * Live rules (in-game / official Season Zero notes):
 *   - Unlocked when all three native class skill lines are rank 50 and the
 *     character is not subclassing.
 *   - Hidden (and purchases refunded) while any native line is swapped out.
 *   - Two Class Mastery Points, distinct from skill points; each passive costs 1.
 *   - Greyed out on characters who have not unlocked it yet.
 *
 * Purchases do not use regular skill-point ranks, so a bought passive can
 * report rank 0. Ownership is the `purchased` flag the addon reads from the
 * game, not a rank I+ check.
 *
 * Every class's line is named "Class Mastery". Identity is the owning class
 * (when the snapshot recorded it) or the five live passives for that class.
 */

export const CLASS_MASTERY_LINE_NAME = "Class Mastery";
export const CLASS_MASTERY_POINTS = 2;

/** Live U50 Class Mastery passives, matching `data/catalog/skills.json`. */
export const CLASS_MASTERY_PASSIVES: Record<string, readonly string[]> = {
  Dragonknight: [
    "Inexorable Descent",
    "Booming Voice",
    "Wildfire Embers",
    "Resolute Defense",
    "Lead from the Front",
  ],
  Sorcerer: [
    "Conservation of Energy",
    "Font of Power",
    "Static Reverberation",
    "Calculated Defense",
    "Sphere of Influence",
  ],
  Nightblade: [
    "Nocturnal Inspiration",
    "An Eye for Exploitation",
    "Above and Beyond",
    "Cutthroat's Focus",
    "Share the Spoils",
  ],
  Templar: [
    "Bastion of Light",
    "Devout Guardian",
    "Bright Harbinger",
    "Judgment's Brand",
    "Steadfast Candescence",
  ],
  Warden: [
    "Tundra's Maw",
    "Wild Adaptation",
    "Glacial Obstinance",
    "Green-Keeper's Hide",
    "Bountiful Harvest",
  ],
  Necromancer: [
    "Nothing Wasted",
    "Malevolent Promise",
    "Cycle Unending",
    "Pound of Flesh",
    "Veil's Forfeit",
  ],
  Arcanist: [
    "Abyssal Emergence",
    "Fate Realigned",
    "Unbound Potential",
    "Erudite's Rigor",
    "Ink-Scribe's Verve",
  ],
};

export function isClassMasteryLineName(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === CLASS_MASTERY_LINE_NAME.toLowerCase();
}

export function isClassMasteryLine(line: {
  name?: string | null;
  classMastery?: boolean;
}): boolean {
  return line.classMastery === true || isClassMasteryLineName(line.name);
}

export function classMasteryPointsSpent(purchasedPassives: number): number {
  return Math.max(0, purchasedPassives);
}

export function classMasteryPassivesFor(className: string | null | undefined): readonly string[] {
  if (!className) return [];
  const key = className.trim().toLowerCase();
  for (const [name, passives] of Object.entries(CLASS_MASTERY_PASSIVES)) {
    if (name.toLowerCase() === key) return passives;
  }
  return [];
}

export function classMasteryOverlap(
  line: {
    className?: string | null;
    abilities?: Array<{ name: string }>;
  },
  characterClass: string,
): number {
  const cls = characterClass.trim().toLowerCase();
  if (!cls) return 0;
  if ((line.className ?? "").trim().toLowerCase() === cls) return 1000;
  const wanted = new Set(classMasteryPassivesFor(characterClass).map((n) => n.toLowerCase()));
  if (wanted.size === 0) return 0;
  let hits = 0;
  for (const ability of line.abilities ?? []) {
    if (wanted.has(ability.name.trim().toLowerCase())) hits += 1;
  }
  return hits;
}

/**
 * A character only has their own Class Mastery tree. Snapshots taken before
 * the addon skipped other classes dump every identically named line; keep
 * the one that belongs to `characterClass`.
 */
export function keepClassMasteryForCharacter<T extends {
  name: string;
  classMastery?: boolean;
  className?: string | null;
  abilities?: Array<{ name: string }>;
}>(lines: T[], characterClass?: string | null): T[] {
  const masteryIdx: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isClassMasteryLine(lines[i]!)) masteryIdx.push(i);
  }
  if (masteryIdx.length === 0) return lines;
  const cls = characterClass?.trim();
  if (!cls) return lines;

  let bestIdx = -1;
  let bestScore = 0;
  for (const i of masteryIdx) {
    const score = classMasteryOverlap(lines[i]!, cls);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  const keep = new Set<number>();
  if (bestScore > 0 && bestIdx >= 0) keep.add(bestIdx);
  return lines.filter((_, i) => !masteryIdx.includes(i) || keep.has(i));
}
