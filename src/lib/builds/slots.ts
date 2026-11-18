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

const TWO_HAND = ["staff", "bow", "greatsword", "battle axe", "battleaxe", "maul"];

/**
 * Map a stickerbook piece or bag item onto a planner slot kind.
 * "Main Hand" / "Off Hand" / "Two Hand" are weapons. Only the armor slot
 * named Hand or Hands is gloves.
 */
export function kindFromPiece(slot: string, type: string, name: string): SlotKind | null {
  const slotL = slot.toLowerCase().trim();
  const blob = `${type} ${name}`.toLowerCase();
  if (slotL.includes("neck")) return "neck";
  if (slotL.includes("ring")) return "ring";
  if (slotL.includes("shoulder")) return "shoulders";
  if (slotL === "head" || slotL.includes("helm")) return "head";
  if (slotL.includes("chest")) return "chest";
  if (slotL === "hands" || slotL === "hand" || slotL.includes("glove")) return "hands";
  if (slotL.includes("waist") || slotL.includes("belt")) return "waist";
  if (slotL.includes("leg")) return "legs";
  if (slotL.includes("feet") || slotL.includes("foot") || slotL.includes("shoe") || slotL.includes("boot")) {
    return "feet";
  }
  if (blob.includes("shield")) return "shield";
  if (TWO_HAND.some((word) => blob.includes(word)) || slotL.includes("two")) return "twoHand";
  if (
    slotL.includes("main") ||
    slotL.includes("off") ||
    slotL.includes("weapon") ||
    slotL.includes("one") ||
    ["dagger", "axe", "mace", "sword"].some((word) => blob.includes(word))
  ) {
    return "oneHand";
  }
  return null;
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

export function locationLabel(location: string): string {
  return LOCATION_LABEL[location] ?? location;
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
