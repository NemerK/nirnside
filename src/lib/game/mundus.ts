import type { WornInput } from "./loadout";
import { parsePieceType, pieceKindFromName } from "./equipment";
import { canonicalTrait } from "./traits";

/**
 * Mundus stones. Sources: UESP Online:Mundus_Stones, Online:Divines.
 *
 * - Thirteen standing stones, each a permanent blessing that boosts one
 *   thing. Only one blessing is active at a time; the Twice-Born Star set
 *   (five pieces) allows two.
 * - The Divines armor trait strengthens the active blessing, more on
 *   higher-quality pieces, up to seven body pieces.
 *
 * The exact numbers move with patches, so the model keeps what each stone
 * boosts, not the values.
 */

export interface MundusStone {
  name: string;
  boosts: string;
}

export const MUNDUS_STONES: readonly MundusStone[] = [
  { name: "The Apprentice", boosts: "Spell Damage" },
  { name: "The Atronach", boosts: "Magicka Recovery" },
  { name: "The Lady", boosts: "Physical and Spell Resistance" },
  { name: "The Lord", boosts: "Maximum Health" },
  { name: "The Lover", boosts: "Physical and Spell Penetration" },
  { name: "The Mage", boosts: "Maximum Magicka" },
  { name: "The Ritual", boosts: "Healing Done" },
  { name: "The Serpent", boosts: "Stamina Recovery" },
  { name: "The Shadow", boosts: "Critical Damage and Critical Healing" },
  { name: "The Steed", boosts: "Movement Speed and Health Recovery" },
  { name: "The Thief", boosts: "Critical Chance" },
  { name: "The Tower", boosts: "Maximum Stamina" },
  { name: "The Warrior", boosts: "Weapon Damage" },
];

export const TWICE_BORN_STAR = "Twice-Born Star";

export function findMundus(raw: string | null | undefined): MundusStone | null {
  const n = (raw ?? "").trim().toLowerCase().replace(/^boon:\s*/, "").replace(/^the\s+/, "");
  if (!n) return null;
  return MUNDUS_STONES.find((s) => s.name.toLowerCase().replace(/^the\s+/, "") === n) ?? null;
}

export interface MundusReading {
  stone: MundusStone | null;
  /** How many blessings the gear allows: two with five Twice-Born Star pieces. */
  allowed: 1 | 2;
  /** Body armor pieces with the Divines trait, which strengthen the blessing. */
  divinesPieces: number;
}

export function readMundus(mundus: string | null | undefined, equipped: readonly (WornInput & { trait?: string | null })[]): MundusReading {
  let twiceBorn = 0;
  let divines = 0;
  for (const e of equipped) {
    if ((e.setName ?? "").toLowerCase().includes(TWICE_BORN_STAR.toLowerCase())) twiceBorn += 1;
    const kind = parsePieceType(e.type) ?? pieceKindFromName(e.name);
    if (kind?.kind === "armor" && canonicalTrait(e.trait) === "Divines") divines += 1;
  }
  return { stone: findMundus(mundus), allowed: twiceBorn >= 5 ? 2 : 1, divinesPieces: divines };
}
