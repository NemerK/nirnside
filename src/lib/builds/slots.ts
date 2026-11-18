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

function specificKind(text: string): SlotKind | null {
  const blob = text.toLowerCase();
  if (!blob.trim()) return null;
  if (/\bnecks?\b|\bnecklaces?\b|\bamulets?\b|\bchokers?\b|\btorcs?\b/.test(blob)) return "neck";
  if (/\brings?\b/.test(blob)) return "ring";
  if (/\bshoulders?\b|\bspaulders?\b|\bpauldrons?\b|\bepaulets?\b|\barm cops\b/.test(blob)) return "shoulders";
  if (/(?:warmasks?|\bmasks?|\bheads?|\bhelms?|\bhelmets?|\bhats?|\bcowls?|\bhoods?|\bcirclets?)\b/.test(blob)) {
    return "head";
  }
  if (/\bchests?\b|\bcuirasses?\b|\brobes?\b|\bjacks?\b/.test(blob)) return "chest";
  if (/\bhands\b|\bgloves?\b|\bgauntlets?\b|\bbracers?\b/.test(blob)) return "hands";
  if (/\bwaists?\b|\bbelts?\b|\bgirdles?\b|\bsashes?\b|\bkilts?\b/.test(blob)) return "waist";
  if (/\blegs?\b|\bgreaves\b|\bbreeches\b|\bguards\b/.test(blob)) return "legs";
  if (/\bfeet\b|\bfoot\b|\bshoes?\b|\bboots?\b|\bsabatons?\b|\btreaders\b/.test(blob)) return "feet";
  if (/\bshields?\b/.test(blob)) return "shield";
  if (TWO_HAND.some((word) => blob.includes(word)) || /\btwo[\s-]?hand/.test(blob)) return "twoHand";
  if (/\bmain\s*hand\b|\boff\s*hand\b|\bone[\s-]?hand|\bdaggers?\b|\baxes?\b|\bmaces?\b|\bswords?\b/.test(blob)) {
    return "oneHand";
  }
  return null;
}

/** A bare "Weapon" label, once staves and bows have already been claimed. */
function genericWeapon(text: string): SlotKind | null {
  return /\bweapons?\b/.test(text.toLowerCase()) ? "oneHand" : null;
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
