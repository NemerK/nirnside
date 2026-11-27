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

/**
 * Order of lines inside a category, as the Skills window lists them, where
 * the game has a fixed order. Weapon and armor come from the weapon-line model.
 */
export const SKILL_WINDOW_LINE_ORDER: Record<string, readonly string[]> = {
  Weapon: ["Two Handed", "One Hand and Shield", "Dual Wield", "Bow", "Destruction Staff", "Restoration Staff"],
  Armor: ["Light Armor", "Medium Armor", "Heavy Armor"],
  Guild: ["Fighters Guild", "Mages Guild", "Undaunted", "Thieves Guild", "Dark Brotherhood", "Psijic Order"],
  World: ["Soul Magic", "Legerdemain", "Vampire", "Werewolf"],
  "Alliance War": ["Assault", "Support"],
  Craft: ["Blacksmithing", "Clothing", "Woodworking", "Jewelry Crafting", "Provisioning", "Enchanting", "Alchemy"],
};

/** Live ESO cap for active and ultimate morph-slot ranks (the game's MAX_RANKS_PER_ABILITY). */
export const MAX_ABILITY_RANK = 4;
