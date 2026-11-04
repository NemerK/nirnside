import { ESO_CLASSES } from "../classes";

/**
 * Saved targets are grouped the way the skill window is: category, then the
 * owning class for class content, then the skill line. A class goal sits only
 * under the class that owns it.
 */

export interface GoalCatalogLine {
  name: string;
  category: string;
  className: string | null;
  classNames?: string[];
}

export interface GoalCatalogAbility {
  name: string;
  lineName: string;
  className: string | null;
  category?: string;
}

export interface GoalCatalogScript {
  name: string;
  slot: string;
}

export interface GoalCatalog {
  lines: GoalCatalogLine[];
  abilities: GoalCatalogAbility[];
  scripts?: GoalCatalogScript[];
}

export interface GoalSection<T> {
  key: string;
  title: string;
  items: T[];
}

export interface GoalGroup<T> {
  key: string;
  title: string;
  className: string | null;
  sections: GoalSection<T>[];
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
  "scribing",
];

const SLOT_TITLE: Record<string, string> = {
  focus: "Focus",
  signature: "Signature",
  affix: "Affix",
};

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function isClassCategory(category: string): boolean {
  const key = category.trim().toLowerCase();
  return key === "class" || key === "class mastery";
}

function displayCategory(category: string): string {
  const raw = category.trim();
  const key = raw.toLowerCase();
  if (key === "class" || key === "class mastery") return "Class";
  if (key === "scribing") return "Scribing";
  if (key === "alliance war") return "Alliance War";
  if (!raw) return "Other";
  return raw.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slotTitle(slot: string): string {
  const key = slot.trim().toLowerCase();
  if (!key) return "Scripts";
  return SLOT_TITLE[key] ?? slot.trim();
}

function categoryRank(title: string, className: string | null): number {
  const key = className ? "class" : title.trim().toLowerCase();
  const index = CATEGORY_ORDER.indexOf(key);
  return index < 0 ? 90 : index;
}

interface Placement {
  category: string;
  className: string | null;
  section: string;
}

export function placeGoal(
  item: { domain: "skillline" | "ability" | "script"; target: string; scope?: string; scopeKey?: string | null },
  catalog: GoalCatalog,
): Placement {
  if (item.domain === "script") {
    const script = catalog.scripts?.find((row) => sameName(row.name, item.target));
    return { category: "Scribing", className: null, section: slotTitle(script?.slot ?? "") };
  }
  if (item.domain === "ability") {
    const ability = catalog.abilities.find((row) => sameName(row.name, item.target));
    if (!ability) return { category: "Other", className: null, section: "Abilities" };
    const line = catalog.lines.find(
      (row) =>
        sameName(row.name, ability.lineName) &&
        (!ability.className || !row.className || sameName(row.className, ability.className)),
    );
    const category = displayCategory(ability.category || line?.category || "");
    const className = isClassCategory(category) ? ability.className ?? line?.className ?? null : null;
    return { category, className, section: ability.lineName || item.target };
  }
  const matches = catalog.lines.filter((row) => sameName(row.name, item.target));
  const line = matches[0];
  if (!line) return { category: "Other", className: null, section: item.target };
  if (!isClassCategory(line.category)) return { category: displayCategory(line.category), className: null, section: item.target };
  if (item.scope === "class" && item.scopeKey) {
    const scoped = matches.find((row) => {
      const owners = row.classNames?.length ? row.classNames : row.className ? [row.className] : [];
      return owners.some((name) => sameName(name, item.scopeKey ?? ""));
    });
    if (scoped) return { category: "Class", className: item.scopeKey, section: item.target };
  }
  const owners = (line.classNames?.length ? line.classNames : matches.map((row) => row.className).filter(Boolean)) as string[];
  const unique = owners.filter((name, index) => owners.findIndex((other) => sameName(other, name)) === index);
  return { category: "Class", className: unique.length === 1 ? unique[0] : null, section: item.target };
}

/** Group targets. When a character class is set, other classes' targets are left out. */
export function groupPlacedGoals<
  T extends { domain: "skillline" | "ability" | "script"; target: string; scope?: string; scopeKey?: string | null },
>(items: T[], catalog: GoalCatalog, characterClass?: string | null): GoalGroup<T>[] {
  const wanted = characterClass?.trim() ?? "";
  const groups = new Map<string, GoalGroup<T>>();
  for (const item of items) {
    const place = placeGoal(item, catalog);
    if (wanted && place.className && !sameName(place.className, wanted)) continue;
    const groupClass = place.className ?? (wanted && place.category === "Class" ? wanted : null);
    const key = groupClass ? `class:${groupClass.toLowerCase()}` : `cat:${place.category.toLowerCase()}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, title: groupClass ?? place.category, className: groupClass, sections: [] };
      groups.set(key, group);
    }
    const sectionKey = place.section.trim().toLowerCase();
    let section = group.sections.find((row) => row.key === sectionKey);
    if (!section) {
      section = { key: sectionKey, title: place.section, items: [] };
      group.sections.push(section);
    }
    section.items.push(item);
  }
  const ordered = [...groups.values()];
  ordered.sort((a, b) => {
    const rank = categoryRank(a.title, a.className) - categoryRank(b.title, b.className);
    if (rank !== 0) return rank;
    const ai = a.className ? ESO_CLASSES.findIndex((name) => sameName(name, a.className ?? "")) : -1;
    const bi = b.className ? ESO_CLASSES.findIndex((name) => sameName(name, b.className ?? "")) : -1;
    if (ai !== bi) return (ai < 0 ? 90 : ai) - (bi < 0 ? 90 : bi);
    return a.title.localeCompare(b.title);
  });
  for (const group of ordered) group.sections.sort((a, b) => a.title.localeCompare(b.title));
  return ordered;
}
