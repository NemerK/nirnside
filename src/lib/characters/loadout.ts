import { parseWornSlot } from "../game/equipment";
import { loadoutOf, type WornInput } from "../game/loadout";

/** A worn piece, keyed the way the snapshot labels equipment slots. */
export type WornSlot = {
  slot: string;
  bar: "front" | "back" | null;
  setName?: string | null;
};

export type WeaponPair<T> = {
  main?: T;
  off?: T;
  rest: T[];
};

export type PlacedGear<T> = {
  head?: T;
  shoulders?: T;
  chest?: T;
  hands?: T;
  waist?: T;
  legs?: T;
  feet?: T;
  neck?: T;
  rings: T[];
  front: WeaponPair<T>;
  back: WeaponPair<T>;
  other: T[];
};

/**
 * Paper-doll slots in the game's equipment order. Armor and jewelry have no
 * bar. Weapons split into the front and back bars, main hand then off hand.
 * Slots are read by the game model (parseWornSlot: "Hands" is armor, only
 * "Main Hand" / "Off Hand" are weapons). Anything else stays in `other` so
 * it still renders.
 */
export function placeEquipped<T extends WornSlot>(items: T[]): PlacedGear<T> {
  const bySlot = new Map<string, T>();
  const rings: T[] = [];
  const other: T[] = [];
  const front: T[] = [];
  for (const item of items) {
    if (item.bar === "front" || item.bar === "back") continue;
    const slot = parseWornSlot(item.slot);
    if (slot === "ring1" || slot === "ring2") rings.push(item);
    else if (slot === "mainhand" || slot === "offhand") front.push(item);
    else if (slot && slot !== "poison" && !bySlot.has(slot)) bySlot.set(slot, item);
    else other.push(item);
  }
  return {
    head: bySlot.get("head"),
    shoulders: bySlot.get("shoulders"),
    chest: bySlot.get("chest"),
    hands: bySlot.get("hands"),
    waist: bySlot.get("waist"),
    legs: bySlot.get("legs"),
    feet: bySlot.get("feet"),
    neck: bySlot.get("necklace"),
    rings,
    front: weaponPair([...items.filter((item) => item.bar === "front"), ...front]),
    back: weaponPair(items.filter((item) => item.bar === "back")),
    other,
  };
}

function weaponPair<T extends WornSlot>(items: T[]): WeaponPair<T> {
  const main = items.find((item) => parseWornSlot(item.slot) === "mainhand");
  const off = items.find((item) => parseWornSlot(item.slot) === "offhand");
  const rest = items.filter((item) => item !== main && item !== off);
  return {
    main: main ?? rest.shift(),
    off: off ?? rest.shift(),
    rest,
  };
}

/**
 * Each worn set and how many of its pieces count, on the fuller bar, by the
 * game's rules (game/loadout.ts): body pieces count on both bars, a
 * two-hander counts twice, perfected and normal pieces are one set. Fullest
 * first. Names are without "Perfected".
 */
export function tallySets(items: WornInput[]): { name: string; count: number }[] {
  return loadoutOf(items)
    .sets.filter((set) => set.name)
    .map((set) => ({ name: set.name, count: Math.max(set.front, set.back) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
