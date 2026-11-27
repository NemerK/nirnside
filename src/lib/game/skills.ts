/**
 * Skill line categories in the order of the in-game Skills window
 * (SKILL_TYPE_CLASS, _WEAPON, _ARMOR, _WORLD, _GUILD, _AVA, _RACIAL,
 * _TRADESKILL). The addon writes the game's own category name; this turns
 * any spelling of it into one label and gives the window's order.
 */
export const SKILL_CATEGORIES = ["Class", "Weapon", "Armor", "World", "Guild", "Alliance War", "Racial", "Craft"] as const;
export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

const ALIASES: Record<string, SkillCategory> = {
  class: "Class",
  weapon: "Weapon",
  armor: "Armor",
  armour: "Armor",
  world: "World",
  guild: "Guild",
  "alliance war": "Alliance War",
  ava: "Alliance War",
  racial: "Racial",
  race: "Racial",
  craft: "Craft",
  crafting: "Craft",
  tradeskill: "Craft",
};

/** "alliance war", "SKILL_TYPE_AVA", "Crafting" → the window's label; unknown names keep their own words. */
export function skillCategory(raw: string | null | undefined, className?: string | null): string {
  if (className) return "Class";
  const n = (raw ?? "").trim().toLowerCase().replace(/^skill_type_/, "").replace(/_/g, " ");
  if (!n) return "Other";
  if (n.startsWith("class")) return "Class";
  return ALIASES[n] ?? n.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Sort by the Skills window's order; anything else after, alphabetically. */
export function compareSkillCategory(a: string, b: string): number {
  const ia = SKILL_CATEGORIES.indexOf(a as SkillCategory);
  const ib = SKILL_CATEGORIES.indexOf(b as SkillCategory);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
}
