import { z } from "zod";
import { coerceCompletedAchievementIds } from "../achievements/pithka";

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
  /** GetCurrentCharacterId of the owner, when known. Survives a reused name. */
  ownerCharacterId: z.string().nullable().default(null),
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

/**
 * One morph slot on an active/ultimate ability. Ranks are independent: the
 * base can be IV while morph 1 is III and morph 2 is IV. `rank` is null when
 * this slot has never been purchased — never invent a rank.
 */
export const MorphSlot = z.object({
  /** 0 = base ability, 1 = first morph, 2 = second morph. */
  slot: z.number().int(),
  name: z.string(),
  abilityId: z.number().int().nonnegative().optional(),
  rank: z.number().int().nullable().optional().default(null),
  purchased: z.boolean().default(false),
  /** In-game .dds icon path (GetAbilityIcon). */
  icon: z.string().nullable().optional(),
  /** In-game tooltip text for this slot (GetAbilityDescription). */
  description: z.string().optional(),
  /** XP into the current rank, as the game reports it. Omitted if unavailable. */
  xp: z.number().int().nonnegative().optional(),
  xpMin: z.number().int().nonnegative().optional(),
  xpMax: z.number().int().nonnegative().optional(),
});
export type MorphSlot = z.infer<typeof MorphSlot>;

export const SkillMorph = z.object({
  name: z.string(),
  abilityId: z.number().int().nonnegative().optional(),
  rank: z.number().int().default(0),
  /** Currently selected slot: 0 = base, 1 = first morph, 2 = second morph. */
  morph: z.number().int().nullable().default(null),
  purchased: z.boolean().default(false),
  /** Applied skill style / skill styling collectible name, if any. */
  skillStyle: z.string().nullable().default(null),
  /** In-game .dds icon path for the currently shown morph/base. */
  icon: z.string().nullable().optional(),
  /** In-game tooltip text for the currently shown morph/base. */
  description: z.string().optional(),
  /** Passive abilities have upgrade ranks, not morphs. */
  passive: z.boolean().default(false),
  /** Passive upgrade cap (e.g. 2). Omitted when unknown or not a passive. */
  maxRank: z.number().int().nullable().optional(),
  /**
   * Per-slot rank for base + both morphs. Empty on older snapshots that only
   * recorded the currently selected morph.
   */
  morphs: lenientArray(MorphSlot).default([]),
});
export type SkillMorph = z.infer<typeof SkillMorph>;

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

/**
 * Wizard's Wardrobe setups, read from that addon's own SavedVariables
 * (`WizardsWardrobeSV`) on disk — the same sanctioned local-only data path we
 * already use. The in-game reader resolves item/skill names and icons, so the
 * app renders exactly what the game gave, never computed. Absent when the
 * player does not use Wizard's Wardrobe.
 */
export const WardrobeGearPiece = z.object({
  slot: z.string().default(""),
  name: z.string().default(""),
  icon: z.string().nullable().optional(),
  setName: z.string().nullable().default(null),
  trait: z.string().nullable().default(null),
  quality: ItemQuality.nullable().optional(),
  mythic: z.boolean().default(false),
});

export const WardrobeSkill = z.object({
  name: z.string().default(""),
  icon: z.string().nullable().optional(),
});

export const WardrobeBar = z.object({
  bar: z.enum(["front", "back"]),
  skills: lenientArray(WardrobeSkill).default([]),
});

export const WardrobeSetup = z.object({
  name: z.string().default(""),
  gear: lenientArray(WardrobeGearPiece).default([]),
  bars: lenientArray(WardrobeBar).default([]),
  /** Champion star names, as slotted in the setup. Empty when none saved. */
  cp: z.array(z.string()).default([]),
  food: WardrobeGearPiece.nullable().default(null),
});

export const WardrobePage = z.object({
  name: z.string().default(""),
  setups: lenientArray(WardrobeSetup).default([]),
});

export const WardrobeZone = z.object({
  /** Wizard's Wardrobe zone tag (GEN, CR, AA, …). */
  tag: z.string().default(""),
  /** Readable zone name (Cloudrest, General, …). */
  name: z.string().default(""),
  pages: lenientArray(WardrobePage).default([]),
});

export const Wardrobe = z.object({
  /** True when the setups are the account-wide Wizard's Wardrobe storage. */
  accountWide: z.boolean().default(false),
  zones: lenientArray(WardrobeZone).default([]),
});
export type Wardrobe = z.infer<typeof Wardrobe>;
export type WardrobeSetup = z.infer<typeof WardrobeSetup>;
export type WardrobeZone = z.infer<typeof WardrobeZone>;
export type WardrobePage = z.infer<typeof WardrobePage>;

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
  /**
   * Class skill lines the account has mastered (leveled to 50), which unlocks
   * them for subclassing on any character. Names only — captured from the game.
   */
  classMasteries: z.array(z.string()).default([]),
  skillLines: lenientArray(SkillLine).default([]),
  champion: lenientArray(ChampionDiscipline).default([]),
  equipped: lenientArray(EquippedItem).default([]),
  companions: lenientArray(Companion).default([]),
  /** Known scribing scripts (names) for this character. */
  scribingScripts: z.array(z.string()).default([]),
  research: lenientArray(z.object({ craft: z.string(), trait: z.string(), remaining: z.string() })).default([]),
  /** Wizard's Wardrobe setups for this character, if that addon is installed. */
  wardrobe: Wardrobe.nullable().default(null),
  /** Unix seconds of this character's last logout snapshot. null = never logged since install. */
  lastSeen: z.number().int().nonnegative().nullable().default(null),
  /** Character wallet gold as of last snapshot. Not account-wide. */
  gold: z.number().int().nonnegative().default(0),
  /** Tel Var stones on this character as of last snapshot. Not account-wide. */
  telVar: z.number().int().nonnegative().default(0),
  /**
   * Set when this character is gone from the live ESO roster (deleted).
   * The last snapshot is kept in Archive; it must not appear as a current toon.
   */
  archivedAt: z.number().int().nonnegative().nullable().default(null),
});
export type Character = z.infer<typeof Character>;

export const StickerbookPiece = z.object({
  /** Gear slot label (Head, Chest, …) or a fallback like "Slot 1". */
  slot: z.string().default(""),
  /**
   * Human-readable item type incl. weight/weapon, e.g. "Heavy Head",
   * "Restoration Staff", "Necklace". This is what the UI shows.
   */
  type: z.string().default(""),
  /** Armor weight ("Light" | "Medium" | "Heavy") when applicable, else null. */
  weight: z.string().nullable().default(null),
  /** The actual item name for this piece, e.g. "Ancient Dragonguard Helm". */
  name: z.string().default(""),
  /** In-game .dds icon path for the piece's item, resolved by GameIcon. */
  icon: z.string().nullable().default(null),
  collected: z.boolean().default(false),
});
export type StickerbookPiece = z.infer<typeof StickerbookPiece>;

/**
 * Pieces are an ordered array (game slot order). Older snapshots wrote a
 * `{ slotLabel: boolean }` map; we transparently upgrade that legacy shape so
 * old data never breaks the UI.
 */
const StickerbookPieces = z.preprocess((v) => {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") {
    return Object.entries(v as Record<string, unknown>).map(([slot, collected]) => ({
      slot,
      type: slot,
      weight: null,
      name: slot,
      icon: null,
      collected: Boolean(collected),
    }));
  }
  return [];
}, z.array(StickerbookPiece));

export const StickerbookSet = z.object({
  setId: z.number().int().nonnegative(),
  name: z.string(),
  /** Top-level category, mirroring the game tree: Overland, Dungeons, Trials… */
  category: z.string().default("Unknown"),
  /** Specific subcategory within the parent (zone/dungeon/trial name). */
  subcategory: z.string().nullable().default(null),
  /** Game's own ordering, so the UI tree matches the in-game order. */
  categoryOrder: z.number().default(0),
  subOrder: z.number().default(0),
  pieces: StickerbookPieces.default([]),
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
  /** Date earned as the game reports it (e.g. "2024-11-05"), or null. */
  date: z.string().nullable().default(null),
});
export type AchievementRecord = z.infer<typeof AchievementRecord>;

/**
 * Account-level scalars use `.catch(...)` (not just `.default(...)`) so a single
 * present-but-invalid value can never reject the whole snapshot. `.default`
 * covers a *missing* value; `.catch` covers a value the game/addon wrote in an
 * unexpected shape (e.g. a currency the API returns negative, or a stray float).
 * This mirrors `lenientArray` above: one odd field degrades to a safe default
 * instead of blanking the entire account. Missing/unreadable data reads as its
 * empty default — never faked, and the character/item lists still load.
 */
export const AccountSnapshot = z.object({
  // A snapshot with no account name is unusable; load.ts backfills it from the
  // SavedVariables account key, so an empty string here is still recoverable.
  displayName: z.string().catch(""),
  region: Region.default("EU").catch("EU"),
  /** ESO API version at time of snapshot (used to detect patch changes). */
  apiVersion: z.number().int().nonnegative().default(0).catch(0),
  esoPlus: z.boolean().default(false).catch(false),
  /** Unix seconds of the most recent snapshot write. */
  lastSnapshot: z.number().int().nonnegative().default(0).catch(0),
  gold: z.number().int().nonnegative().default(0).catch(0),
  // Per-currency values are coerced tolerantly so one odd amount does not drop
  // every currency; the whole record still falls back to {} as a last resort.
  currencies: z
    .record(z.string(), z.number().int().catch(0))
    .default({})
    .catch({}),
  guilds: lenientArray(Guild).default([]),
  items: lenientArray(Item).default([]),
  characters: lenientArray(Character).default([]),
  /**
   * Characters that were on the account and have since been deleted.
   * Last-known snapshot only; they are not the live roster.
   */
  archivedCharacters: lenientArray(Character).default([]),
  stickerbook: lenientArray(StickerbookSet).default([]),
  /**
   * Legacy: account-wide earned achievement NAMES only. Kept for back-compat
   * with older snapshots. New snapshots also fill `achievementRecords` below,
   * which the board prefers because it carries the full game truth.
   */
  achievements: z.array(z.string()).default([]).catch([]),
  /**
   * Structured trial/dungeon/arena achievements straight from the game — the
   * authoritative source for the Pithka-style board. ESO achievements are
   * account-wide; the API does not expose which character earned them, so we do
   * not fabricate per-character attribution.
   */
  achievementRecords: lenientArray(AchievementRecord).default([]),
  /**
   * Every achievement id the account has completed (a flat set). This is what
   * the Pithka-style board runs on: for each achievement Pithka tracks (by id),
   * we simply check membership here — exactly what the in-game add-on does with
   * IsAchievementComplete. Sparse and cheap; written on logout/ReloadUI only.
   */
    completedAchievementIds: z
      .preprocess((v) => coerceCompletedAchievementIds(v), z.array(z.number().int().nonnegative()))
      .catch([]),
  /**
   * Per-character completed ids. Maelstrom Arena clears are still character-bound
   * in live ESO; we keep each toon's list and union them so the board stays
   * checked if any character has earned it.
   */
  characterCompletedIds: z
    .preprocess((v) => {
      if (v == null || typeof v !== "object" || Array.isArray(v)) return {};
      const out: Record<string, number[]> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        const ids = coerceCompletedAchievementIds(val);
        if (ids.length > 0) out[k] = ids;
      }
      return out;
    }, z.record(z.string(), z.array(z.number().int().nonnegative())))
    .catch({}),
});
export type AccountSnapshot = z.infer<typeof AccountSnapshot>;
