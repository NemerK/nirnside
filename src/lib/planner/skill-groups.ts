import { classMasteryPassivesFor, isClassMasteryLineName } from "../skills/class-mastery";

/**
 * How the planner nests skill lines: a category, and for Class a class name
 * under that, then the lines themselves. Order follows the in-game skill window.
 */

export interface PlannerLineRef {
  name: string;
  category: string;
  className: string | null;
}

export interface PlannerClassGroup<T extends PlannerLineRef> {
  name: string;
  lines: T[];
}

export interface PlannerCategory<T extends PlannerLineRef> {
  key: string;
  title: string;
  /** Set for the Class category. Other categories list their lines directly. */
  classes: PlannerClassGroup<T>[] | null;
  lines: T[];
}

const CATEGORY_ORDER = [
  "class",
  "weapon",
  "armor",
  "world",
  "guild",
  "alliance war",
  "craft",
  "racial",
];

function categoryRank(key: string): number {
  const i = CATEGORY_ORDER.indexOf(key);
  return i < 0 ? 90 : i;
}

function classRank(name: string, classOrder: string[]): number {
  const i = classOrder.findIndex((c) => c.toLowerCase() === name.toLowerCase());
  return i < 0 ? 90 : i;
}

/** A chosen class keeps that class's lines, including its own Class Mastery. */
export function plannerClassScopeAllows(
  line: { category: string; className: string | null },
  selectedClass: string | null | undefined,
): boolean {
  const wanted = selectedClass?.trim().toLowerCase() ?? "";
  if (!wanted) return true;
  if (line.category.trim().toLowerCase() !== "class") return true;
  return (line.className ?? "").trim().toLowerCase() === wanted;
}

/**
 * Class Mastery is one display name for every class. A Dragonknight line only
 * lists Dragonknight passives; the same for each other class.
 */
export function abilitiesOnPlannerLine<T extends { name: string; lineName: string; className: string | null }>(
  abilities: readonly T[],
  line: { name: string; className: string | null },
): T[] {
  const lineName = line.name.trim().toLowerCase();
  const mastery = isClassMasteryLineName(line.name);
  const lineClass = (line.className ?? "").trim().toLowerCase();
  const passiveNames = mastery
    ? new Set(classMasteryPassivesFor(line.className).map((name) => name.toLowerCase()))
    : null;
  return abilities.filter((ability) => {
    if (ability.lineName.trim().toLowerCase() !== lineName) return false;
    if (!mastery) return true;
    const abilityClass = (ability.className ?? "").trim().toLowerCase();
    if (lineClass && abilityClass) return abilityClass === lineClass;
    if (lineClass && passiveNames && passiveNames.size > 0) {
      return passiveNames.has(ability.name.trim().toLowerCase());
    }
    return !lineClass && !abilityClass;
  });
}

/** One skill on a line: the base ability and its two morphs, in game order. */
export interface PlannerAbilityRow {
  lineName: string;
  className: string | null;
  passive: boolean;
  base: { name: string; icon: string | null };
  /** Morph 1, then morph 2. Passives have none. */
  morphs: { name: string; icon: string | null }[];
}

/** Rows for one skill line, with Class Mastery limited to that class. */
export function abilityRowsOnPlannerLine(
  rows: readonly PlannerAbilityRow[],
  line: { name: string; className: string | null },
): PlannerAbilityRow[] {
  const names = new Set(
    abilitiesOnPlannerLine(
      rows.map((row) => ({ name: row.base.name, lineName: row.lineName, className: row.className })),
      line,
    ).map((row) => row.name.trim().toLowerCase()),
  );
  return rows.filter(
    (row) =>
      row.lineName.trim().toLowerCase() === line.name.trim().toLowerCase() &&
      names.has(row.base.name.trim().toLowerCase()),
  );
}

/**
 * Abilities the planner can target. Passives come with the skill-line rank,
 * so they are not a separate IV / morph choice.
 */
export function activeAbilityRowsOnPlannerLine(
  rows: readonly PlannerAbilityRow[],
  line: { name: string; className: string | null },
): PlannerAbilityRow[] {
  return abilityRowsOnPlannerLine(rows, line).filter((row) => !row.passive);
}

/**
 * The snapshot names an ability after the form the character currently has.
 * Slot 0 is still the base, and slots 1 and 2 are the morphs.
 */
export function plannerProgressionNames(ability: {
  name: string;
  morphs?: readonly { slot?: number; name?: string | null }[];
}): { base: string; morphs: string[] } {
  const named = (ability.morphs ?? [])
    .map((slot) => ({ slot: slot.slot, name: slot.name?.trim() ?? "" }))
    .filter((slot) => slot.name);
  const baseSlot = named.find((slot) => slot.slot === 0);
  const morphSlots = named.filter((slot) => slot.slot === 1 || slot.slot === 2);
  if (baseSlot && morphSlots.length > 0) {
    const base = baseSlot.name;
    return {
      base,
      morphs: morphSlots
        .map((slot) => slot.name)
        .filter((name) => name.toLowerCase() !== base.toLowerCase())
        .slice(0, 2),
    };
  }
  const headline = ability.name.trim();
  return {
    base: headline,
    morphs: named
      .map((slot) => slot.name)
      .filter((name) => name.toLowerCase() !== headline.toLowerCase())
      .slice(0, 2),
  };
}

/**
 * A morph is not its own ability. Drop a row whose name is already listed as
 * a morph of another ability on the same line.
 */
export function withoutAbilityMorphDuplicates(rows: readonly PlannerAbilityRow[]): PlannerAbilityRow[] {
  const morphNames = new Set<string>();
  for (const row of rows) {
    const line = plannerLineKey({ name: row.lineName, className: row.className });
    const base = row.base.name.trim().toLowerCase();
    for (const morph of row.morphs) {
      const name = morph.name.trim().toLowerCase();
      if (name && name !== base) morphNames.add(`${line}::${name}`);
    }
  }
  return rows.filter(
    (row) => !morphNames.has(`${plannerLineKey({ name: row.lineName, className: row.className })}::${row.base.name.trim().toLowerCase()}`),
  );
}

/** Open/selected state for a line. Class Mastery keys include the class. */
export function plannerLineKey(line: { name: string; className: string | null }): string {
  const name = line.name.trim().toLowerCase();
  if (!isClassMasteryLineName(line.name)) return name;
  return `${(line.className ?? "").trim().toLowerCase()}::${name}`;
}

export function groupPlannerLines<T extends PlannerLineRef>(
  lines: readonly T[],
  classOrder: readonly string[],
): PlannerCategory<T>[] {
  const byCat = new Map<string, T[]>();
  for (const line of lines) {
    const title = line.category.trim() || "Skill";
    const key = title.toLowerCase();
    const arr = byCat.get(key);
    if (arr) arr.push(line);
    else byCat.set(key, [line]);
  }

  return [...byCat.entries()]
    .sort((a, b) => categoryRank(a[0]) - categoryRank(b[0]) || a[0].localeCompare(b[0]))
    .map(([key, entries]) => {
      const title = entries.find((l) => l.category.trim())?.category.trim() || key;
      if (key !== "class") {
        return {
          key,
          title,
          classes: null,
          lines: [...entries].sort((a, b) => a.name.localeCompare(b.name)),
        };
      }
      const byClass = new Map<string, T[]>();
      for (const line of entries) {
        const name = line.className?.trim() || "Class";
        const arr = byClass.get(name);
        if (arr) arr.push(line);
        else byClass.set(name, [line]);
      }
      const classes = [...byClass.entries()]
        .sort((a, b) => classRank(a[0], [...classOrder]) - classRank(b[0], [...classOrder]) || a[0].localeCompare(b[0]))
        .map(([name, classLines]) => ({
          name,
          lines: [...classLines].sort((a, b) => a.name.localeCompare(b.name)),
        }));
      return { key, title, classes, lines: [] };
    });
}
