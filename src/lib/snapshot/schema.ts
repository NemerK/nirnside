import { z } from "zod";

/**
 * The Nirnside snapshot contract.
 *
 * This is the single source of truth for the shape of data the in-game addon
 * (NirnsideSnapshot) writes into SavedVariables, and that the importer reads.
 * The addon writes plain Lua tables mirroring these shapes; the Lua parser turns
 * them into these objects, and Zod validates them before they touch the DB.
 *
 * Everything here is "static, as-of-last-logout" data. Nothing here models
 * ticking buffs, food timers, or combat math (see .cursor/rules/nirnside.mdc).
 */

/**
 * Resilient array: parses each element independently and keeps only the ones
 * that validate, dropping (not rejecting-the-whole-import) anything malformed.
 * Real game data has occasional surprises; one odd ability must never throw away
 * an entire character — let alone the whole account. Non-array input degrades to
 * an empty list. This is applied at every level so failures stay contained to
 * the smallest possible piece.
 */
export function lenientArray<T extends z.ZodTypeAny>(element: T) {
  return z
    .array(z.unknown())
    .transform((arr) =>
      arr.flatMap((el) => {
        const r = element.safeParse(el);
        return r.success ? [r.data as z.infer<T>] : [];
      }),
    )
    .catch([] as z.infer<T>[]);
}

export const Region = z.enum(["EU", "NA"]);
export type Region = z.infer<typeof Region>;

export const Alliance = z.enum(["Aldmeri Dominion", "Daggerfall Covenant", "Ebonheart Pact"]);

/** Where an item physically lives on the account. */
export const ItemLocation = z.enum([
  "worn",
  "backpack",
  "bank",
  "subscriberBank",
  "craftBag",
]);
export type ItemLocation = z.infer<typeof ItemLocation>;

export const ItemQuality = z.enum([
  "trash",
  "normal",
  "fine",
  "superior",
  "epic",
  "legendary",
  "mythic",
]);
export type ItemQuality = z.infer<typeof ItemQuality>;

export const Item = z.object({
  /** ESO itemId (numeric). Stable per item definition. */
  itemId: z.number().int().nonnegative(),
  /** Full itemLink string (|H...|h|h) as ESO produces it. Kept verbatim. */
  itemLink: z.string().optional(),
  name: z.string(),
  icon: z.string().optional(),
  quality: ItemQuality.optional(),
  /** Stack size in this location. */
  count: z.number().int().nonnegative().default(1),
  /** Which character owns this stack, or null for account-wide bags. */
  ownerCharacter: z.string().nullable().default(null),
  location: ItemLocation,
  /** Set name if the item belongs to an item set, else null. */
  setName: z.string().nullable().default(null),
  setId: z.number().int().nonnegative().nullable().default(null),
  trait: z.string().nullable().default(null),
  /** Requested/effective level (e.g. CP160). */
  level: z.number().int().nonnegative().nullable().default(null),
  equipSlot: z.string().nullable().default(null),
  /** Item still exists in the live game catalog? False = keep showing in bags, hide from browse. */
  obtainable: z.boolean().default(true),
  bound: z.boolean().default(false),
  stolen: z.boolean().default(false),
  /** Scribing scripts inscribed on this item, if any. */
  scribing: z.array(z.string()).default([]),
});
export type Item = z.infer<typeof Item>;

export const SkillMorph = z.object({
  name: z.string(),
  abilityId: z.number().int().nonnegative().optional(),
  rank: z.number().int().default(0),
  /** 0 = base, 1 = first morph, 2 = second morph. null = not morphed. */
  morph: z.number().int().nullable().default(null),
  purchased: z.boolean().default(false),
  /** Applied skill style / skill styling collectible name, if any. */
  skillStyle: z.string().nullable().default(null),
});

export const SkillLine = z.object({
  name: z.string(),
  category: z.string(),
  rank: z.number().int().default(0),
  /** True if this line comes from subclassing (borrowed from another class). */
  subclassed: z.boolean().default(false),
  abilities: lenientArray(SkillMorph).default([]),
});
export type SkillLine = z.infer<typeof SkillLine>;

export const ChampionStar = z.object({
  name: z.string(),
  points: z.number().int().default(0),
  slotted: z.boolean().default(false),
});

export const ChampionDiscipline = z.object({
  /** Warfare / Fitness / Craft. */
  name: z.string(),
  stars: lenientArray(ChampionStar).default([]),
});

export const EquippedItem = z.object({
  slot: z.string(),
  /** Which bar: "front", "back", or null for armor/jewelry. */
  bar: z.enum(["front", "back"]).nullable().default(null),
  itemId: z.number().int().nonnegative().optional(),
  name: z.string(),
  icon: z.string().optional(),
  quality: ItemQuality.optional(),
  setName: z.string().nullable().default(null),
  trait: z.string().nullable().default(null),
  enchant: z.string().nullable().default(null),
  scribing: z.array(z.string()).default([]),
});

export const Companion = z.object({
  name: z.string(),
  rapport: z.string().nullable().default(null),
  level: z.number().int().nonnegative().default(0),
});

export const Character = z.object({
  id: z.string(),
  name: z.string(),
  class: z.string(),
  race: z.string(),
  alliance: Alliance,
  gender: z.string().nullable().default(null),
  level: z.number().int().default(1),
  championPoints: z.number().int().default(0),
  mundus: z.string().nullable().default(null),
  /** Attribute point spend. */
  attributes: z
    .object({ magicka: z.number().int(), health: z.number().int(), stamina: z.number().int() })
    .partial()
    .default({}),
  vampire: z
    .object({ isVampire: z.boolean().default(false), stage: z.number().int().default(0) })
    .default({ isVampire: false, stage: 0 }),
  werewolf: z.object({ isWerewolf: z.boolean().default(false) }).default({ isWerewolf: false }),
  /** True if this char uses Class Mastery (pure class, no subclassing). */
  classMastery: z.boolean().default(false),
  skillLines: lenientArray(SkillLine).default([]),
  champion: lenientArray(ChampionDiscipline).default([]),
  equipped: lenientArray(EquippedItem).default([]),
  companions: lenientArray(Companion).default([]),
  /** Known scribing scripts (names) for this character. */
  scribingScripts: z.array(z.string()).default([]),
  research: lenientArray(z.object({ craft: z.string(), trait: z.string(), remaining: z.string() })).default([]),
  /** Unix seconds of this character's last logout snapshot. null = never logged since install. */
  lastSeen: z.number().int().nonnegative().nullable().default(null),
});
export type Character = z.infer<typeof Character>;

export const StickerbookSet = z.object({
  setId: z.number().int().nonnegative(),
  name: z.string(),
  category: z.string().default("Unknown"),
  /** Piece slot name -> collected boolean. */
  pieces: z.record(z.string(), z.boolean()).default({}),
});
export type StickerbookSet = z.infer<typeof StickerbookSet>;

export const Guild = z.object({
  name: z.string(),
  rank: z.string().nullable().default(null),
  trader: z.boolean().default(false),
});

/**
 * One achievement, exactly as the game reports it. This is the Pithka-style
 * board's single source of truth: name, description, points and completion all
 * come straight from ESO, so nothing is guessed. `category` is the top-level
 * ESO achievement category ("Dungeons" / "Trials" / "Group Arenas" / ...) and
 * `content` is the subcategory (the specific dungeon/trial/arena) that the
 * board groups by. `title` is the title reward, if this achievement grants one.
 */
export const AchievementRecord = z.object({
  id: z.number().int().nonnegative().default(0),
  name: z.string(),
  description: z.string().default(""),
  points: z.number().int().nonnegative().default(0),
  completed: z.boolean().default(false),
  category: z.string().default(""),
  content: z.string().default(""),
  title: z.string().nullable().default(null),
});
export type AchievementRecord = z.infer<typeof AchievementRecord>;

export const AccountSnapshot = z.object({
  displayName: z.string(),
  region: Region.default("EU"),
  /** ESO API version at time of snapshot (used to detect patch changes). */
  apiVersion: z.number().int().nonnegative().default(0),
  esoPlus: z.boolean().default(false),
  /** Unix seconds of the most recent snapshot write. */
  lastSnapshot: z.number().int().nonnegative().default(0),
  gold: z.number().int().nonnegative().default(0),
  currencies: z.record(z.string(), z.number().int().nonnegative()).default({}),
  guilds: lenientArray(Guild).default([]),
  items: lenientArray(Item).default([]),
  characters: lenientArray(Character).default([]),
  stickerbook: lenientArray(StickerbookSet).default([]),
  /**
   * Legacy: account-wide earned achievement NAMES only. Kept for back-compat
   * with older snapshots. New snapshots also fill `achievementRecords` below,
   * which the board prefers because it carries the full game truth.
   */
  achievements: z.array(z.string()).default([]),
  /**
   * Structured trial/dungeon/arena achievements straight from the game — the
   * authoritative source for the Pithka-style board. ESO achievements are
   * account-wide; the API does not expose which character earned them, so we do
   * not fabricate per-character attribution.
   */
  achievementRecords: lenientArray(AchievementRecord).default([]),
});
export type AccountSnapshot = z.infer<typeof AccountSnapshot>;
