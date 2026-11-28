import { z } from "zod";
import { StatEffect } from "../snapshot/schema";

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

export const CatalogDomain = z.enum(["set", "skillline", "skill", "cp", "grimoire", "script", "achievement", "mundus", "food", "recipe"]);
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
  /** The perfected line (GetItemLinkSetBonusInfo's third return): only perfected pieces count toward it. */
  perfected: z.boolean().nullable().optional(),
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
  icon: z.string().nullable().default(null),
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
  /** Live rank cap for this line (50 for most; guild/PvP/curse lines cap lower). */
  maxRank: z.number().int().positive().nullable().default(null),
  /** The same cap as the game reported it (Catalog 0.2.10+); reference rows never have it. */
  gameMaxRank: z.number().int().positive().nullable().optional().catch(undefined),
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
  /** GetCraftedAbilityScriptIcon, when a catalog scan has seen it. */
  icon: z.string().nullable().default(null),
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

/** A Mundus blessing as the game describes it this patch. Catalog 0.2.5+, or learned from a character's buff. */
export const CatalogMundus = z.object({
  ...base,
  abilityId: z.number().int().nonnegative().nullable().default(null),
  description: z.string().default(""),
  icon: z.string().nullable().default(null),
  /** The stone's amounts in the game's numbers. Catalog 0.2.9+. */
  effects: z.array(StatEffect).default([]).catch([]),
});
export type CatalogMundus = z.infer<typeof CatalogMundus>;

/** A provisioning dish and the buff it gives, from the game's tooltip. Catalog 0.2.5+. */
export const CatalogFood = z.object({
  ...base,
  itemId: z.number().int().nonnegative(),
  recipeList: z.string().default(""),
  quality: z.number().int().nonnegative().nullable().default(null),
  /** "Food" or "Drink", as the game types the dish. */
  kind: z.string().nullable().default(null),
  subtype: z.string().nullable().default(null),
  buffName: z.string().nullable().default(null),
  buff: z.string().default(""),
  icon: z.string().nullable().default(null),
});
export type CatalogFood = z.infer<typeof CatalogFood>;

/**
 * A provisioning recipe or furnishing plan, as the game's crafting station
 * and tooltip describe it (Catalog 0.2.11+). Keyed by what it makes:
 * `recipe-<result item id>`. The game doesn't say where a plan drops.
 */
const RecipeItem = z.object({
  itemId: z.number().int().positive().nullable().optional().catch(undefined),
  name: z.string().default(""),
  icon: z.string().nullable().optional(),
  quantity: z.number().int().nonnegative().nullable().optional(),
  quality: z.number().int().nonnegative().nullable().optional(),
});
export const CatalogRecipe = z.object({
  ...base,
  list: z.string().nullable().default(null),
  kind: z.enum(["provisioning", "furnishing"]).default("provisioning"),
  /** Nirnside's key for the craft whose station makes it (blacksmithing, clothing, …). */
  craft: z.string().nullable().default(null),
  /** The game's name for that craft ("Jewelry Crafting"). */
  craftName: z.string().nullable().default(null),
  /** "Requires Recipe Quality N". */
  qualityReq: z.number().int().nonnegative().nullable().default(null),
  levelReq: z.number().int().nonnegative().nullable().default(null),
  /** "Requires Metalworking 3": the craft, its level passive's name, and the level. */
  requires: z
    .array(z.object({ craft: z.string().nullable().optional(), passive: z.string().nullable().optional(), level: z.number().int().positive() }))
    .default([])
    .catch([]),
  ingredients: z.array(RecipeItem).default([]).catch([]),
  result: RecipeItem.extend({
    stack: z.number().int().positive().nullable().optional(),
    sellPrice: z.number().int().nonnegative().nullable().optional(),
    flavor: z.string().nullable().optional(),
  }).nullable().default(null).catch(null),
  /** Where the game files a furnishing, its theme and placement limit. */
  furnishing: z
    .object({
      category: z.string().nullable().optional(),
      subcategory: z.string().nullable().optional(),
      theme: z.string().nullable().optional(),
      limit: z.string().nullable().optional(),
    })
    .nullable()
    .default(null)
    .catch(null),
});
export type CatalogRecipe = z.infer<typeof CatalogRecipe>;

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
  mundus: z.array(CatalogMundus).default([]),
  food: z.array(CatalogFood).default([]),
  recipes: z.array(CatalogRecipe).default([]).catch([]),
});
export type CatalogBundle = z.infer<typeof CatalogBundle>;

export const SOURCE_RANK: Record<CatalogSource, number> = {
  ingame: 3,
  community: 2,
  reference: 1,
};
