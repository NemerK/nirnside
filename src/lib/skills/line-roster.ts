import type { SkillLine, SkillMorph } from "../snapshot/schema";
import { abilityIsKnown, bestRank, displayAbility, romanRank } from "./ability";

export type RosterSkill = {
  id: string;
  name: string;
  type: "active" | "passive" | "ultimate";
  morphs: string[];
};

export type RosterCharacter = {
  id: string;
  name: string;
  className: string;
  archivedAt?: number | null;
  skillLines: SkillLine[];
};

export type RosterLine = {
  name: string;
  /** Owning class for a class line or Class Mastery. Empty for lines anyone can learn. */
  className: string | null;
  classMastery: boolean;
};

export type LineAbilityProgress = {
  id: string;
  name: string;
  known: boolean;
  /** False when this character's snapshot has no row for the ability. */
  inSnapshot: boolean;
  /** Morph or passive name, once they have purchased it. */
  face: string | null;
  /** Roman rank. Empty when the game did not record one. */
  rankLabel: string | null;
};

export type CharacterLineProgress = {
  id: string;
  name: string;
  className: string;
  state: "learned" | "undiscovered" | "other-class";
  rank: number | null;
  /** Line cap, or Class Mastery points. Null when the live cap is not known. */
  cap: number | null;
  subclassed: boolean;
  classMastery: boolean;
  /** Class Mastery points spent. Null on an ordinary line. */
  points: number | null;
  abilities: LineAbilityProgress[];
};

function fold(value: string): string {
  return value.trim().toLowerCase();
}

function findLine(character: RosterCharacter, line: RosterLine): SkillLine | null {
  const named = character.skillLines.filter((row) => fold(row.name) === fold(line.name));
  if (named.length === 0) return null;
  const wanted = fold(line.className ?? "");
  if (!line.classMastery) return named[0] ?? null;
  const exact = wanted ? named.find((row) => fold(row.className ?? "") === wanted) : undefined;
  if (exact) return exact;
  if (wanted && fold(character.className) === wanted) {
    return named.find((row) => !row.className?.trim()) ?? null;
  }
  return null;
}

function abilityKeys(ability: SkillMorph): string[] {
  const names = [ability.name, ...(ability.morphs ?? []).map((slot) => slot.name)];
  return names.map((name) => fold(name)).filter(Boolean);
}

function indexAbilities(line: SkillLine): Map<string, SkillMorph> {
  const map = new Map<string, SkillMorph>();
  for (const ability of line.abilities) {
    for (const key of abilityKeys(ability)) {
      if (!map.has(key)) map.set(key, ability);
    }
  }
  return map;
}

function progressFor(skill: { id: string; name: string }, ability: SkillMorph | null): LineAbilityProgress {
  if (!ability) {
    return { id: skill.id, name: skill.name, known: false, inSnapshot: false, face: null, rankLabel: null };
  }
  if (!abilityIsKnown(ability)) {
    return { id: skill.id, name: skill.name, known: false, inSnapshot: true, face: null, rankLabel: null };
  }
  const face = displayAbility(ability);
  const slot = (ability.morphs ?? []).find((row) => row.slot === face.morphSlot);
  const rank = bestRank(slot?.rank, ability.rank);
  const label = romanRank(rank);
  return {
    id: skill.id,
    name: skill.name,
    known: true,
    inSnapshot: true,
    face: face.name,
    rankLabel: label === "—" ? null : label,
  };
}

function abilitiesFor(line: SkillLine, skills: readonly RosterSkill[]): LineAbilityProgress[] {
  const index = indexAbilities(line);
  const used = new Set<SkillMorph>();
  const rows = skills.map((skill) => {
    const keys = [skill.name, ...skill.morphs].map((name) => fold(name));
    const ability =
      keys
        .map((key) => index.get(key))
        .find((hit): hit is SkillMorph => hit != null && !used.has(hit)) ?? null;
    if (ability) used.add(ability);
    return progressFor(skill, ability);
  });
  for (const ability of line.abilities) {
    if (used.has(ability)) continue;
    rows.push(progressFor({ id: `snapshot:${fold(ability.name)}`, name: ability.name }, ability));
  }
  return rows;
}

/**
 * Every live character's progress in one skill line.
 * Roster order is kept. A class line the character cannot learn stays visible
 * as "other class" so the account is still complete.
 */
export function skillLineRoster(
  line: RosterLine,
  skills: readonly RosterSkill[],
  characters: readonly RosterCharacter[],
  cap: number | null,
): CharacterLineProgress[] {
  const className = fold(line.className ?? "");
  const rows: CharacterLineProgress[] = [];
  for (const character of characters) {
    if (character.archivedAt != null && character.archivedAt > 0) continue;
    const found = findLine(character, line);
    if (!found) {
      const otherClass = Boolean(className) && fold(character.className) !== className;
      rows.push({
        id: character.id,
        name: character.name,
        className: character.className,
        state: otherClass ? "other-class" : "undiscovered",
        rank: null,
        cap: otherClass ? null : cap,
        subclassed: false,
        classMastery: line.classMastery,
        points: null,
        abilities: [],
      });
      continue;
    }
    const classMastery = line.classMastery || found.classMastery === true;
    const points = classMastery ? found.abilities.filter((ability) => abilityIsKnown(ability)).length : null;
    rows.push({
      id: character.id,
      name: character.name,
      className: character.className,
      state: "learned",
      rank: classMastery ? null : found.rank,
      cap,
      subclassed: found.subclassed === true,
      classMastery,
      points,
      abilities: abilitiesFor(found, skills),
    });
  }
  return rows;
}
