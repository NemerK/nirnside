import { mythicNameKey } from "../collections/mythic-match";

/**
 * Equip slots the planner can fill. Body is the five armor pieces the player
 * named (chest, legs, feet, belt, gloves). Head and shoulders belong to the
 * monster set. A two-hander is one item and two set pieces.
 */
export type SlotKind =
  | "head"
  | "shoulders"
  | "chest"
  | "hands"
  | "waist"
  | "legs"
  | "feet"
  | "neck"
  | "ring"
  | "oneHand"
  | "twoHand"
  | "shield";

export type BarStyle = "twohand" | "dual" | "shield";

/** Armor and jewelry can be Divines. Weapons cannot. */
export function wantsDivines(kind: SlotKind): boolean {
  return kind !== "oneHand" && kind !== "twoHand" && kind !== "shield";
}

/**
 * Crystals to reconstruct one collected piece.
 *
 * The game's published curve: 75 when only one piece of the set is collected,
 * 25 when every piece is collected, and a straight line between those ends,
 * rounded down. A one-piece set (a mythic) is 25 as soon as it is collected.
 * Returns null when the piece is not collected or the snapshot has no total.
 */
export function reconstructionCost(collected: number, total: number): number | null {
  if (collected <= 0 || total <= 0) return null;
  if (total === 1 || collected >= total) return 25;
  return Math.floor(75 - (50 * (collected - 1)) / (total - 1));
}

/** Trait change at the transmute station. Fixed in the live game. */
export const TRAIT_CHANGE_CRYSTALS = 50;

/**
 * Map a stickerbook piece or bag item onto a planner slot kind.
 *
 * The addon stores the collection-slot string in `slot` ("Head", or "Slot 3"
 * when the client string is missing) and the real item type in `type`
 * ("Heavy Chest", "Inferno Staff", "Necklace"). Armor and jewelry live in
 * that type, so both fields are read. The item name is only a fallback: a
 * set name must not reclassify every piece.
 *
 * "Main Hand" / "Off Hand" / "Two Hand" are weapons. Only Hands, gloves,
 * gauntlets, or bracers are the glove slot.
 */
export function kindFromPiece(slot: string, type: string, name: string): SlotKind | null {
  const labeled = specificKind(`${slot} ${type}`);
  // Armor and jewelry on the slot or type win. A shield named on the item
  // still beats an "Off Hand" label, and a bow beats a bare "Weapon" label.
  if (labeled && labeled !== "oneHand" && labeled !== "twoHand") return labeled;
  const named = specificKind(name);
  if (named === "shield") return "shield";
  if (labeled === "twoHand" || named === "twoHand") return "twoHand";
  if (labeled === "oneHand" || named === "oneHand") return "oneHand";
  return labeled ?? named ?? genericWeapon(`${slot} ${type} ${name}`);
}

/**
 * The game's own piece names, longest first.
 *
 * Light, medium, and heavy do not share words. Legs are Breeches, Guards, or
 * Greaves. Shoulders are Epaulets, Arm Cops, or Pauldrons. A set name such as
 * "Slivers of the Null Arca" contains none of these, so it must not pick a slot.
 * "Null Arca Guards" does: Guards are medium legs.
 */
const PIECE_PHRASES: ReadonlyArray<readonly [string, SlotKind]> = [
  ["arm cops", "shoulders"],
  ["epaulets", "shoulders"],
  ["epaulet", "shoulders"],
  ["pauldrons", "shoulders"],
  ["pauldron", "shoulders"],
  ["spaulders", "shoulders"],
  ["spaulder", "shoulders"],
  ["shoulders", "shoulders"],
  ["shoulder", "shoulders"],
  ["warmasks", "head"],
  ["warmask", "head"],
  ["helmets", "head"],
  ["helmet", "head"],
  ["circlets", "head"],
  ["circlet", "head"],
  ["helms", "head"],
  ["helm", "head"],
  ["cowls", "head"],
  ["cowl", "head"],
  ["hoods", "head"],
  ["hood", "head"],
  ["masks", "head"],
  ["mask", "head"],
  ["hats", "head"],
  ["hat", "head"],
  ["head", "head"],
  ["cuirasses", "chest"],
  ["cuirass", "chest"],
  ["jerkins", "chest"],
  ["jerkin", "chest"],
  ["robes", "chest"],
  ["robe", "chest"],
  ["jacks", "chest"],
  ["jack", "chest"],
  ["chest", "chest"],
  ["gauntlets", "hands"],
  ["gauntlet", "hands"],
  ["bracers", "hands"],
  ["bracer", "hands"],
  ["gloves", "hands"],
  ["glove", "hands"],
  ["hands", "hands"],
  ["girdles", "waist"],
  ["girdle", "waist"],
  ["sashes", "waist"],
  ["sash", "waist"],
  ["belts", "waist"],
  ["belt", "waist"],
  ["waist", "waist"],
  ["breeches", "legs"],
  ["greaves", "legs"],
  ["guards", "legs"],
  ["legs", "legs"],
  ["sabatons", "feet"],
  ["sabaton", "feet"],
  ["treaders", "feet"],
  ["shoes", "feet"],
  ["shoe", "feet"],
  ["boots", "feet"],
  ["boot", "feet"],
  ["feet", "feet"],
  ["foot", "feet"],
  ["necklaces", "neck"],
  ["necklace", "neck"],
  ["amulets", "neck"],
  ["amulet", "neck"],
  ["chokers", "neck"],
  ["choker", "neck"],
  ["torcs", "neck"],
  ["torc", "neck"],
  ["necks", "neck"],
  ["neck", "neck"],
  ["rings", "ring"],
  ["ring", "ring"],
  ["restoration staff", "twoHand"],
  ["healing staff", "twoHand"],
  ["inferno staff", "twoHand"],
  ["fire staff", "twoHand"],
  ["lightning staff", "twoHand"],
  ["ice staff", "twoHand"],
  ["frost staff", "twoHand"],
  ["greatsword", "twoHand"],
  ["battle axe", "twoHand"],
  ["battleaxe", "twoHand"],
  ["maul", "twoHand"],
  ["shields", "shield"],
  ["shield", "shield"],
  ["bows", "twoHand"],
  ["bow", "twoHand"],
  ["staves", "twoHand"],
  ["staff", "twoHand"],
  ["two-handed", "twoHand"],
  ["two hand", "twoHand"],
  ["daggers", "oneHand"],
  ["dagger", "oneHand"],
  ["maces", "oneHand"],
  ["mace", "oneHand"],
  ["hammers", "oneHand"],
  ["hammer", "oneHand"],
  ["axes", "oneHand"],
  ["axe", "oneHand"],
  ["swords", "oneHand"],
  ["sword", "oneHand"],
  ["main hand", "oneHand"],
  ["off hand", "oneHand"],
  ["one-handed", "oneHand"],
  ["one hand", "oneHand"],
];

function mentions(blob: string, phrase: string): boolean {
  const body = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${body}\\b`, "i").test(blob);
}

function specificKind(text: string): SlotKind | null {
  const blob = text.toLowerCase();
  if (!blob.trim()) return null;
  for (const [phrase, kind] of PIECE_PHRASES) {
    if (mentions(blob, phrase)) return kind;
  }
  return null;
}

/** A bare "Weapon" label, once staves and bows have already been claimed. */
function genericWeapon(text: string): SlotKind | null {
  return /\bweapons?\b/.test(text.toLowerCase()) ? "oneHand" : null;
}

/** One stickerbook piece, already labeled by the game with a slot and a type. */
export interface CatalogPiece {
  name: string;
  slot: string;
  type: string;
  itemId?: number | null;
}

function kindFromWeapon(weapon: FrontWeapon): SlotKind {
  if (weapon === "shield") return "shield";
  return isTwoHandedWeapon(weapon) ? "twoHand" : "oneHand";
}

function labeledPiece(slot: string, type: string, name: string): { kind: SlotKind; weapon: FrontWeapon | null } | null {
  const weapon = weaponTypeFromPiece(slot, type, name);
  const kind = kindFromPiece(slot, type, name) ?? (weapon ? kindFromWeapon(weapon) : null);
  if (!kind) return null;
  return { kind, weapon };
}

/**
 * Which slot an owned item fills.
 *
 * The equip type written by the addon wins. Otherwise the stickerbook piece
 * with the same item id, or the same unique name, supplies the slot the game
 * gave that piece. The item name is only the last resort, and only when it
 * uses a real piece word such as Guards.
 */
export function resolveOwnedPiece(
  item: { name: string; itemId?: number | null; equipSlot?: string | null },
  pieces: readonly CatalogPiece[],
): { kind: SlotKind; weapon: FrontWeapon | null } | null {
  if (item.equipSlot?.trim()) {
    const fromSlot = labeledPiece(item.equipSlot, "", "");
    if (fromSlot) {
      // "Main Hand" and "Two Hand" name the hand, not the weapon. The item
      // name still says Dagger or Bow, and that is the piece the character holds.
      const fromName = labeledPiece("", "", item.name);
      if (fromName?.weapon && (fromName.kind === fromSlot.kind || fromName.kind === "shield")) return fromName;
      return fromSlot;
    }
  }
  const id = item.itemId ?? 0;
  if (id > 0) {
    const byId = agree(pieces.filter((piece) => piece.itemId === id));
    if (byId) return byId;
  }
  const wanted = item.name.trim().toLowerCase();
  if (wanted) {
    const byName = agree(pieces.filter((piece) => piece.name.trim().toLowerCase() === wanted));
    if (byName) return byName;
  }
  return labeledPiece("", "", item.name);
}

function agree(pieces: readonly CatalogPiece[]): { kind: SlotKind; weapon: FrontWeapon | null } | null {
  const resolved = pieces
    .map((piece) => labeledPiece(piece.slot, piece.type, ""))
    .filter((row): row is { kind: SlotKind; weapon: FrontWeapon | null } => row != null);
  if (resolved.length === 0) return null;
  const kind = resolved[0]!.kind;
  const weapon = resolved[0]!.weapon;
  if (resolved.some((row) => row.kind !== kind || row.weapon !== weapon)) return null;
  return { kind, weapon };
}

const BODY_SLOTS: readonly SlotKind[] = ["chest", "hands", "waist", "legs", "feet"];
const WEAPON_SLOTS: readonly SlotKind[] = ["oneHand", "twoHand", "shield"];

/**
 * Slots a chosen role is allowed to fill.
 *
 * Body always includes the five body slots, and front always includes weapons
 * and jewelry, even when the stickerbook only recorded weapons (a perfected
 * trial set, or a piece whose slot label did not parse). The set's own kinds
 * stay in the list so an owned necklace can still be used.
 */
export function kindsForRole(
  role: "body" | "monster" | "mythic" | "front" | "back",
  known: readonly SlotKind[],
  name = "",
): SlotKind[] {
  if (role === "mythic") {
    const kind = known[0] ?? kindFromPiece("", "", name);
    return kind ? [kind] : [];
  }
  if (role === "monster") return ["head", "shoulders"];
  if (role === "back") {
    const weapons = known.filter((kind) => WEAPON_SLOTS.includes(kind));
    return weapons.length > 0 ? weapons : [...WEAPON_SLOTS];
  }
  const defaults: readonly SlotKind[] =
    role === "body" ? BODY_SLOTS : [...WEAPON_SLOTS, "neck", "ring", ...BODY_SLOTS];
  const kinds = [...known];
  for (const kind of defaults) {
    if (!kinds.includes(kind)) kinds.push(kind);
  }
  return kinds;
}

/**
 * Monster sets are the head-and-shoulders sets. On a live account they sit
 * under Dungeons, named for the dungeon, so the category rarely contains the
 * word "monster".
 */
export function isMonsterSet(set: { mythic: boolean; category: string; kinds: readonly SlotKind[] }): boolean {
  if (set.mythic) return false;
  if (set.category.toLowerCase().includes("monster")) return true;
  return set.kinds.length > 0 && set.kinds.every((kind) => kind === "head" || kind === "shoulders");
}

/** Names the research grid uses for one slot, across the three armor weights and weapons. */
const RESEARCH_LINES: Record<SlotKind, readonly string[]> = {
  head: ["helm", "hat", "helmet"],
  shoulders: ["pauldron", "epaulets", "arm cops"],
  chest: ["cuirass", "robe", "jack"],
  hands: ["gauntlets", "gloves", "bracers"],
  waist: ["girdle", "sash", "belt"],
  legs: ["greaves", "breeches", "guards"],
  feet: ["sabatons", "shoes", "boots"],
  neck: ["necklace"],
  ring: ["ring"],
  oneHand: ["axe", "mace", "sword", "dagger"],
  twoHand: ["battle axe", "maul", "greatsword", "bow", "inferno staff", "ice staff", "lightning staff", "restoration staff"],
  shield: ["shield"],
};

export function lineMatchesKind(lineName: string, kind: SlotKind): boolean {
  const name = lineName.trim().toLowerCase();
  return RESEARCH_LINES[kind].some((line) => line === name);
}

/** "Slivers of the Null Arca" and "Slivers of Null Arca" share a key. Perfected stays distinct. */
export function gearSetKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\bthe\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Keys that should match an owned item to a stickerbook or catalog set. */
export function setMatchKeys(name: string): string[] {
  const keys = new Set<string>();
  const gear = gearSetKey(name);
  if (gear) keys.add(gear);
  const myth = gearSetKey(mythicNameKey(name));
  if (myth) keys.add(myth);
  return [...keys];
}

export function setsShareKey(a: readonly string[], b: readonly string[]): boolean {
  return a.some((key) => b.includes(key));
}

const LOCATION_LABEL: Record<string, string> = {
  worn: "Worn",
  backpack: "Backpack",
  bank: "Bank",
  subscriberBank: "ESO+ bank",
  craftBag: "Craft bag",
};

/** These bags belong to the account. A character name on them is not where the item is. */
const ACCOUNT_BAGS = new Set(["bank", "subscriberBank", "craftBag"]);

export function locationLabel(location: string): string {
  return LOCATION_LABEL[location] ?? location;
}

/**
 * The character who is holding this stack.
 * Worn and backpack name that character. The bank, ESO+ bank, and craft bag do not.
 */
export function characterHolding(owner: string | null | undefined, location: string): string | null {
  if (!owner || ACCOUNT_BAGS.has(location)) return null;
  return owner;
}

export function isDivinesTrait(trait: string | null | undefined): boolean {
  return (trait ?? "").trim().toLowerCase() === "divines";
}

/** Standard slots when a snapshot has no piece list. */
export function kindsForCategory(category: string, subcategory: string | null): SlotKind[] {
  const blob = `${category} ${subcategory ?? ""}`.toLowerCase();
  if (blob.includes("mythic")) return [];
  if (blob.includes("monster")) return ["head", "shoulders"];
  if (blob.includes("arena")) return ["oneHand", "twoHand", "shield"];
  return [
    "head",
    "shoulders",
    "chest",
    "hands",
    "waist",
    "legs",
    "feet",
    "neck",
    "ring",
    "oneHand",
    "twoHand",
    "shield",
  ];
}

export function isCraftedCategory(category: string): boolean {
  return category.toLowerCase().includes("craft");
}

/** A specific front-bar weapon. A two-hander, staff, or bow fills both slots. */
export type FrontWeapon =
  | "greatsword"
  | "battleAxe"
  | "maul"
  | "bow"
  | "inferno"
  | "ice"
  | "lightning"
  | "restoration"
  | "sword"
  | "axe"
  | "mace"
  | "dagger"
  | "shield";

export const FRONT_MAIN_WEAPONS: readonly { id: FrontWeapon; label: string; hands: "two" | "one" }[] = [
  { id: "greatsword", label: "Greatsword", hands: "two" },
  { id: "battleAxe", label: "Battle Axe", hands: "two" },
  { id: "maul", label: "Maul", hands: "two" },
  { id: "bow", label: "Bow", hands: "two" },
  { id: "inferno", label: "Inferno Staff", hands: "two" },
  { id: "ice", label: "Ice Staff", hands: "two" },
  { id: "lightning", label: "Lightning Staff", hands: "two" },
  { id: "restoration", label: "Restoration Staff", hands: "two" },
  { id: "sword", label: "Sword", hands: "one" },
  { id: "axe", label: "Axe", hands: "one" },
  { id: "mace", label: "Mace", hands: "one" },
  { id: "dagger", label: "Dagger", hands: "one" },
];

export const FRONT_OFF_WEAPONS: readonly { id: FrontWeapon; label: string }[] = [
  { id: "sword", label: "Sword" },
  { id: "axe", label: "Axe" },
  { id: "mace", label: "Mace" },
  { id: "dagger", label: "Dagger" },
  { id: "shield", label: "Shield" },
];

const WEAPON_LABEL = new Map<FrontWeapon, string>(
  [...FRONT_MAIN_WEAPONS, { id: "shield" as const, label: "Shield", hands: "one" as const }].map((weapon) => [
    weapon.id,
    weapon.label,
  ]),
);

export function isTwoHandedWeapon(weapon: FrontWeapon): boolean {
  return FRONT_MAIN_WEAPONS.some((entry) => entry.id === weapon && entry.hands === "two");
}

export function weaponLabel(weapon: FrontWeapon): string {
  return WEAPON_LABEL.get(weapon) ?? weapon;
}

export function parseFrontWeapon(value: string): FrontWeapon | null {
  return WEAPON_LABEL.has(value as FrontWeapon) ? (value as FrontWeapon) : null;
}

/** The research-grid line for one weapon. */
export function weaponResearchLine(weapon: FrontWeapon): string {
  return weaponLabel(weapon).toLowerCase();
}

/**
 * Inferno Staff, Bow, Dagger, and the rest, from the addon's type string or the
 * item name. Checked before the coarser one-hand / two-hand slot kind.
 */
export function weaponTypeFromPiece(slot: string, type: string, name: string): FrontWeapon | null {
  const blob = `${slot} ${type} ${name}`.toLowerCase();
  if (/restoration staff|healing staff/.test(blob)) return "restoration";
  if (/inferno staff|fire staff/.test(blob)) return "inferno";
  if (/ice staff|frost staff/.test(blob)) return "ice";
  if (/lightning staff/.test(blob)) return "lightning";
  if (/\bbows?\b/.test(blob)) return "bow";
  if (/greatswords?|two[\s-]?handed sword/.test(blob)) return "greatsword";
  if (/battle ?axes?|two[\s-]?handed axe/.test(blob)) return "battleAxe";
  if (/\bmauls?\b|two[\s-]?handed hammer/.test(blob)) return "maul";
  if (/\bshields?\b/.test(blob)) return "shield";
  if (/\bdaggers?\b/.test(blob)) return "dagger";
  if (/\bmaces?\b|\bhammers?\b/.test(blob)) return "mace";
  if (/\baxes?\b/.test(blob)) return "axe";
  if (/\bswords?\b/.test(blob)) return "sword";
  return null;
}
