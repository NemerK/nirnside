import {
  ARMOR_SLOTS,
  JEWELRY,
  SLOT_LABEL,
  WEAPONS,
  WEAPON_LABEL,
  WEIGHTS,
  WEIGHT_LABEL,
  parsePieceType,
  pieceFromKey,
  type ArmorSlot,
  type Jewelry,
  type PieceKind,
  type Weapon,
  type Weight,
} from "./equipment";

/**
 * What a set comes in, from the pieces the game lists for it. The sticker
 * book scan (GetItemSetCollectionPieceInfo) returns every piece of a set
 * whether collected or not, so this is the game's own answer:
 *
 * - a trial or dungeon set: every slot in light, medium and heavy, both
 *   pieces of jewelry, every weapon and a shield;
 * - a monster set: head and shoulders, in each weight;
 * - an arena set: weapons only;
 * - a mythic: one piece.
 *
 * Learned items (game_items) add pieces seen in play for sets the sticker
 * book doesn't cover.
 */
export interface SetProfile {
  /** Weights any armor piece comes in. */
  weights: Weight[];
  /** For each armor slot the set has, the weights that slot comes in. */
  slots: Partial<Record<ArmorSlot, Weight[]>>;
  jewelry: Jewelry[];
  weapons: Weapon[];
  /** How many distinct pieces the game lists. */
  pieces: number;
  shape: SetShape;
}

export type SetShape =
  | "full" // armor in every slot, plus jewelry and weapons
  | "armor" // armor only (some or all slots)
  | "head-shoulders" // monster sets
  | "weapons" // arena and weapon-only sets
  | "jewelry"
  | "single" // a mythic or another one-piece set
  | "mixed"
  | "unknown";

const WEIGHT_ORDER = (a: Weight, b: Weight) => WEIGHTS.indexOf(a) - WEIGHTS.indexOf(b);

export function setProfile(kinds: readonly (PieceKind | null | undefined)[]): SetProfile {
  const weights = new Set<Weight>();
  const slots: Partial<Record<ArmorSlot, Set<Weight>>> = {};
  const jewelry = new Set<Jewelry>();
  const weapons = new Set<Weapon>();
  const seen = new Set<string>();
  for (const k of kinds) {
    if (!k) continue;
    if (k.kind === "armor") {
      weights.add(k.weight);
      (slots[k.slot] ??= new Set()).add(k.weight);
      seen.add(`${k.weight}-${k.slot}`);
    } else if (k.kind === "jewelry") {
      jewelry.add(k.jewelry);
      seen.add(k.jewelry);
    } else {
      weapons.add(k.weapon);
      seen.add(k.weapon);
    }
  }
  const slotList = ARMOR_SLOTS.filter((s) => slots[s]);
  const hasArmor = slotList.length > 0;
  let shape: SetShape = "unknown";
  if (seen.size === 1) shape = "single";
  else if (hasArmor && slotList.length === ARMOR_SLOTS.length && jewelry.size > 0 && weapons.size > 0) shape = "full";
  else if (hasArmor && slotList.every((s) => s === "head" || s === "shoulders") && jewelry.size === 0 && weapons.size === 0)
    shape = "head-shoulders";
  else if (hasArmor && jewelry.size === 0 && weapons.size === 0) shape = "armor";
  else if (!hasArmor && weapons.size > 0 && jewelry.size === 0) shape = "weapons";
  else if (!hasArmor && jewelry.size > 0 && weapons.size === 0) shape = "jewelry";
  else if (seen.size > 0) shape = "mixed";

  return {
    weights: [...weights].sort(WEIGHT_ORDER),
    slots: Object.fromEntries(slotList.map((s) => [s, [...slots[s]!].sort(WEIGHT_ORDER)])) as SetProfile["slots"],
    jewelry: JEWELRY.filter((j) => jewelry.has(j)),
    weapons: WEAPONS.filter((w) => weapons.has(w)),
    pieces: seen.size,
    shape,
  };
}

/** From sticker-book pieces as stored ({ type, weight }) and learned piece keys. */
export function setProfileFrom(
  pieces: readonly { type?: string | null; weight?: string | null }[],
  learnedKinds: readonly (string | null)[] = [],
): SetProfile {
  return setProfile([
    ...pieces.map((p) => parsePieceType(p.type, p.weight)),
    ...learnedKinds.map((k) => (k ? pieceFromKey(k) : null)),
  ]);
}

/** Can this set be worn in this weight (in any slot, or in the given slot)? */
export function setComesIn(profile: SetProfile, weight: Weight, slot?: ArmorSlot): boolean {
  return slot ? !!profile.slots[slot]?.includes(weight) : profile.weights.includes(weight);
}

/**
 * One line for people: "Light, medium or heavy, all 7 slots · jewelry ·
 * weapons and shield", "Head and shoulders, light, medium or heavy",
 * "Weapons only: bow, inferno staff".
 */
export function describeSetProfile(p: SetProfile): string {
  if (p.shape === "unknown") return "";
  const or = (words: string[]) =>
    words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
  const and = (words: string[]) =>
    words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
  const weightWords = or(p.weights.map((w) => WEIGHT_LABEL[w].toLowerCase()));
  const slots = Object.keys(p.slots) as ArmorSlot[];
  const parts: string[] = [];
  if (slots.length > 0) {
    const where =
      slots.length === ARMOR_SLOTS.length ? `all ${slots.length} armor slots` : and(slots.map((s) => SLOT_LABEL[s].toLowerCase()));
    parts.push(`${weightWords} armor, ${where}`);
  }
  if (p.jewelry.length > 0) parts.push(p.jewelry.length === 2 ? "necklace and rings" : p.jewelry[0] === "ring" ? "rings" : "necklace");
  if (p.weapons.length > 0) {
    const onlyShield = p.weapons.length === 1 && p.weapons[0] === "shield";
    const all = p.weapons.length >= WEAPONS.length - 1;
    parts.push(
      onlyShield
        ? "shield"
        : all
          ? `every weapon${p.weapons.includes("shield") ? " and a shield" : ""}`
          : and(p.weapons.map((w) => WEAPON_LABEL[w].toLowerCase())),
    );
  }
  const text = parts.join(" · ");
  if (p.shape === "weapons") return `Weapons only: ${text}`;
  if (p.shape === "single") return `One piece: ${text}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
