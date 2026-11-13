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

function abilityRowForName(rows: readonly PlannerAbilityRow[], name: string): PlannerAbilityRow | undefined {
  return rows.find(
    (row) => row.base.name === name || row.morphs.some((morph) => morph.name === name),
  );
}

/**
 * A morph is learned on top of its base, so picking a morph also picks the
 * base. Clearing the base clears its morphs.
 */
export function toggleAbilitySelection(
  selected: ReadonlySet<string>,
  name: string,
  rows: readonly PlannerAbilityRow[],
): Set<string> {
  const next = new Set(selected);
  const row = abilityRowForName(rows, name);
  const isBase = !row || row.base.name === name;
  if (next.has(name)) {
    next.delete(name);
    if (row && isBase) {
      for (const morph of row.morphs) next.delete(morph.name);
    }
    return next;
  }
  if (row && !isBase) next.add(row.base.name);
  next.add(name);
  return next;
}

/** Select or clear every name on a line without flipping them one by one. */
export function setAbilityNamesSelected(
  selected: ReadonlySet<string>,
  names: readonly string[],
  on: boolean,
): Set<string> {
  const next = new Set(selected);
  for (const name of names) {
    if (on) next.add(name);
    else next.delete(name);
  }
  return next;
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
