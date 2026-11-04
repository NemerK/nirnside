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
