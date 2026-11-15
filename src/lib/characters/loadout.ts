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
 * Anything the slot name does not match stays in `other` so it still renders.
 */
export function placeEquipped<T extends WornSlot>(items: T[]): PlacedGear<T> {
  const worn = items.filter((item) => item.bar == null);
  const used = new Set<T>();
  const take = (match: string[]) => {
    const found = worn.find(
      (item) => !used.has(item) && match.some((part) => item.slot.toLowerCase().includes(part)),
    );
    if (found) used.add(found);
    return found;
  };

  const shoulders = take(["shoulder"]);
  const head = take(["head"]);
  const chest = take(["chest"]);
  const hands = take(["hand", "glove", "bracer"]);
  const waist = take(["waist", "belt"]);
  const legs = take(["leg", "pant", "greave"]);
  const feet = take(["feet", "foot", "boot", "shoe"]);
  const neck = take(["neck"]);
  const rings = worn.filter((item) => !used.has(item) && item.slot.toLowerCase().includes("ring"));
  for (const ring of rings) used.add(ring);

  return {
    head,
    shoulders,
    chest,
    hands,
    waist,
    legs,
    feet,
    neck,
    rings,
    front: weaponPair(items.filter((item) => item.bar === "front")),
    back: weaponPair(items.filter((item) => item.bar === "back")),
    other: worn.filter((item) => !used.has(item)),
  };
}

function weaponPair<T extends WornSlot>(items: T[]): WeaponPair<T> {
  const main = items.find((item) => item.slot.toLowerCase().includes("main"));
  const off = items.find((item) => item.slot.toLowerCase().includes("off"));
  const rest = items.filter((item) => item !== main && item !== off);
  return {
    main: main ?? rest.shift(),
    off: off ?? rest.shift(),
    rest,
  };
}

/** Piece counts for the sets actually worn, fullest set first. */
export function tallySets(items: { setName?: string | null }[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const name = item.setName?.trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
