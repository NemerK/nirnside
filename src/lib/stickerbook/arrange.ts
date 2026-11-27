/**
 * Lay a set's pieces out the way the game's sticker book does: armor as a
 * weight-by-slot table, then jewelry, then weapons and shields. Anything the
 * snapshot names in a way that doesn't fit lands in "other", never dropped.
 */

export const ARMOR_WEIGHTS = ["Light", "Medium", "Heavy"] as const;
export const ARMOR_SLOTS = ["Head", "Shoulders", "Chest", "Hands", "Waist", "Legs", "Feet"] as const;

export type ArmorWeight = (typeof ARMOR_WEIGHTS)[number];
export type ArmorSlotName = (typeof ARMOR_SLOTS)[number];

export interface ArrangedPieces<P> {
  /** weight → slot → piece. Empty when the set has no armor. */
  armor: Map<ArmorWeight, Map<ArmorSlotName, P>>;
  jewelry: P[];
  weapons: P[];
  other: P[];
}

const SLOT_ALIASES: Record<string, ArmorSlotName> = {
  head: "Head",
  helm: "Head",
  shoulder: "Shoulders",
  shoulders: "Shoulders",
  chest: "Chest",
  hand: "Hands",
  hands: "Hands",
  waist: "Waist",
  leg: "Legs",
  legs: "Legs",
  foot: "Feet",
  feet: "Feet",
};

const WEAPON_ORDER = [
  "axe",
  "mace",
  "sword",
  "dagger",
  "battle axe",
  "maul",
  "greatsword",
  "bow",
  "inferno staff",
  "flame staff",
  "ice staff",
  "frost staff",
  "lightning staff",
  "restoration staff",
  "shield",
];

export function arrangePieces<P extends { type?: string | null; slot?: string | null; weight?: string | null }>(
  pieces: P[],
): ArrangedPieces<P> {
  const out: ArrangedPieces<P> = { armor: new Map(), jewelry: [], weapons: [], other: [] };
  for (const p of pieces) {
    const type = (p.type ?? "").trim().toLowerCase();
    const m = /^(light|medium|heavy)\s+(\w+)$/.exec(type);
    const weightWord = m?.[1] ?? (p.weight ?? "").trim().toLowerCase();
    const slot = SLOT_ALIASES[m?.[2] ?? ""] ?? (weightWord ? SLOT_ALIASES[(p.slot ?? "").trim().toLowerCase()] : undefined);
    const weight = ARMOR_WEIGHTS.find((w) => w.toLowerCase() === weightWord);
    if (weight && slot) {
      let row = out.armor.get(weight);
      if (!row) out.armor.set(weight, (row = new Map()));
      if (!row.has(slot)) {
        row.set(slot, p);
        continue;
      }
    } else if (/\b(necklace|ring|amulet)\b/.test(type)) {
      out.jewelry.push(p);
      continue;
    } else if (WEAPON_ORDER.some((w) => type === w || type.endsWith(` ${w}`))) {
      out.weapons.push(p);
      continue;
    }
    out.other.push(p);
  }
  const rank = (p: P) => {
    const t = (p.type ?? "").trim().toLowerCase();
    const i = WEAPON_ORDER.findIndex((w) => t === w || t.endsWith(` ${w}`));
    return i < 0 ? 99 : i;
  };
  out.weapons.sort((a, b) => rank(a) - rank(b));
  out.jewelry.sort((a, b) => Number(/ring/i.test(a.type ?? "")) - Number(/ring/i.test(b.type ?? "")));
  return out;
}
