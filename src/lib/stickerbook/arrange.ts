import {
  ARMOR_SLOTS as GAME_SLOTS,
  SLOT_LABEL,
  WEAPONS,
  WEIGHTS as GAME_WEIGHTS,
  WEIGHT_LABEL,
  parsePieceType,
  type PieceKind,
} from "../game/equipment";

/**
 * Lay a set's pieces out the way the game's sticker book does: armor as a
 * weight-by-slot table, then jewelry, then weapons and shields. What a piece
 * is comes from the game model; anything it can't place lands in "other",
 * never dropped.
 */

export const ARMOR_WEIGHTS = GAME_WEIGHTS.map((w) => WEIGHT_LABEL[w]);
export const ARMOR_SLOTS = GAME_SLOTS.map((s) => SLOT_LABEL[s]);

export type ArmorWeight = (typeof ARMOR_WEIGHTS)[number];
export type ArmorSlotName = (typeof ARMOR_SLOTS)[number];

export interface ArrangedPieces<P> {
  /** Weight label → slot label → piece. Empty when the set has no armor. */
  armor: Map<string, Map<string, P>>;
  jewelry: P[];
  weapons: P[];
  other: P[];
}

export function arrangePieces<P extends { type?: string | null; slot?: string | null; weight?: string | null }>(
  pieces: P[],
): ArrangedPieces<P> {
  const out: ArrangedPieces<P> = { armor: new Map(), jewelry: [], weapons: [], other: [] };
  const kinds = new Map<P, PieceKind>();
  for (const p of pieces) {
    const kind = parsePieceType(p.type, p.weight) ?? parsePieceType(p.slot, p.weight);
    if (!kind) {
      out.other.push(p);
      continue;
    }
    kinds.set(p, kind);
    if (kind.kind === "armor") {
      const w = WEIGHT_LABEL[kind.weight];
      const s = SLOT_LABEL[kind.slot];
      let row = out.armor.get(w);
      if (!row) out.armor.set(w, (row = new Map()));
      if (row.has(s)) out.other.push(p);
      else row.set(s, p);
    } else if (kind.kind === "jewelry") out.jewelry.push(p);
    else out.weapons.push(p);
  }
  const rank = (p: P) => {
    const k = kinds.get(p);
    return k?.kind === "weapon" ? WEAPONS.indexOf(k.weapon) : 99;
  };
  out.weapons.sort((a, b) => rank(a) - rank(b));
  // Necklace before rings, as the game lists them.
  const isRing = (p: P) => {
    const k = kinds.get(p);
    return k?.kind === "jewelry" && k.jewelry === "ring" ? 1 : 0;
  };
  out.jewelry.sort((a, b) => isRing(a) - isRing(b));
  return out;
}
