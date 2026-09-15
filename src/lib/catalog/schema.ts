import { z } from "zod";

/**
 * The Tamriel catalog contract — the "everything about ESO" half of the app.
 *
 * Accuracy rule (see .cursor/rules/nirnside.mdc): in-game data is truth. Every
 * entry carries a `source`, and the app badges anything that isn't in-game
 * verified. Numeric combat values are the most volatile per patch, so reference
 * seed data marks itself accordingly and the in-game catalog scan overrides it.
 */

export const CatalogSource = z.enum(["ingame", "community", "reference"]);
export type CatalogSource = z.infer<typeof CatalogSource>;

export const CatalogDomain = z.enum(["set", "skillline", "skill", "cp", "grimoire", "script", "achievement"]);
export type CatalogDomain = z.infer<typeof CatalogDomain>;

const base = {
  id: z.string(),
  name: z.string(),
  source: CatalogSource.default("reference"),
  patch: z.string().default("U50"),
};

export const SetBonus = z.object({
  pieces: z.number().int().min(1).max(12),
  text: z.string(),
});

export const CatalogSet = z.object({
  ...base,
  setId: z.number().int().nonnegative().nullable().default(null),
  category: z.string(), // Trial, Dungeon, Monster Set, Mythic, PvP, Crafted, Arena, Overland, Class
  dlc: z.string().nullable().default(null),
  dropSource: z.string().nullable().default(null),
  maxEquip: z.number().int().min(1).max(12).default(5),
  traitsNeeded: z.number().int().nonnegative().nullable().default(null), // crafted sets
  bonuses: z.array(SetBonus).default([]),
  icon: z.string().nullable().default(null),
});
export type CatalogSet = z.infer<typeof CatalogSet>;

export const CatalogMorph = z.object({
  name: z.string(),
  abilityId: z.number().int().nonnegative().nullable().default(null),
  description: z.string().default(""),
  /** true = a morph of a base ability; false = the base skill. */
  isMorph: z.boolean().default(false),
});

export const CatalogSkill = z.object({
  ...base,
  lineId: z.string(),
  type: z.enum(["active", "passive", "ultimate"]).default("active"),
  description: z.string().default(""),
  morphs: z.array(CatalogMorph).default([]),
  icon: z.string().nullable().default(null),
});
export type CatalogSkill = z.infer<typeof CatalogSkill>;

export const CatalogSkillLine = z.object({
  ...base,
  category: z.string(), // Class, Weapon, Armor, World, Guild, Alliance War, Racial, Craft
  className: z.string().nullable().default(null),
  icon: z.string().nullable().default(null),
});
export type CatalogSkillLine = z.infer<typeof CatalogSkillLine>;

export const CatalogCPStar = z.object({
  ...base,
  category: z.string(), // Warfare, Fitness, Craft
  type: z.enum(["slottable", "passive", "cluster"]).default("slottable"),
  description: z.string().default(""),
  maxPoints: z.number().int().positive().default(50),
  icon: z.string().nullable().default(null),
});
export type CatalogCPStar = z.infer<typeof CatalogCPStar>;

/** Scribing: a grimoire defines which script slots it accepts. */
export const CatalogGrimoire = z.object({
  ...base,
  skillLine: z.string(),
  description: z.string().default(""),
  /** Which focus/signature/affix script ids are valid for this grimoire. */
  focusScripts: z.array(z.string()).default([]),
  signatureScripts: z.array(z.string()).default([]),
  affixScripts: z.array(z.string()).default([]),
  icon: z.string().nullable().default(null),
});
export type CatalogGrimoire = z.infer<typeof CatalogGrimoire>;

export const CatalogScript = z.object({
  ...base,
  slot: z.enum(["focus", "signature", "affix"]),
  effect: z.string().default(""),
});
export type CatalogScript = z.infer<typeof CatalogScript>;

/** Pithka-style trial/dungeon/arena achievement (account-wide in ESO). */
export const CatalogAchievement = z.object({
  ...base,
  category: z.string(), // Trial, Dungeon, Arena
  content: z.string(), // the specific trial/dungeon/arena name
  subtype: z.enum(["Completion", "Hard Mode", "Speed", "No Death", "Trifecta"]).default("Completion"),
  description: z.string().default(""),
});
export type CatalogAchievement = z.infer<typeof CatalogAchievement>;

/** A domain -> entries bundle, as stored in the reference JSON seeds. */
export const CatalogBundle = z.object({
  patch: z.string().default("U50"),
  source: CatalogSource.default("reference"),
  sets: z.array(CatalogSet).default([]),
  skillLines: z.array(CatalogSkillLine).default([]),
  skills: z.array(CatalogSkill).default([]),
  cp: z.array(CatalogCPStar).default([]),
  grimoires: z.array(CatalogGrimoire).default([]),
  scripts: z.array(CatalogScript).default([]),
  achievements: z.array(CatalogAchievement).default([]),
});
export type CatalogBundle = z.infer<typeof CatalogBundle>;

export const SOURCE_RANK: Record<CatalogSource, number> = {
  ingame: 3,
  community: 2,
  reference: 1,
};
