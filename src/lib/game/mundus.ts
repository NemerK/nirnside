import type { WornInput } from "./loadout";
import { parsePieceType, pieceKindFromName } from "./equipment";
import { canonicalTrait } from "./traits";

/**
 * Mundus stones.
 *
 * Sources:
 * - UESP Online:Mundus_Stones and Online:Divines, for the stones, Twice-Born
 *   Star and the Divines trait;
 * - official Update 51 patch notes (live 28 September 2026): the Warrior now
 *   grants Weapon and Spell Damage, and the Apprentice now grants 8% more
 *   experience and inspiration instead of Spell Damage.
 *
 * Rules:
 * - Thirteen standing stones, each a lasting blessing ("Boon: The Warrior").
 *   One blessing at a time; the Twice-Born Star set (five pieces) allows two.
 * - The Divines armor trait strengthens the blessing, more on higher-quality
 *   pieces, up to seven body pieces.
 *
 * What each stone boosts is kept here as reference. The numbers move with
 * patches, so they are never written here: the game states them. A
 * character's own blessing text comes from its saved buffs (addon 0.9.43+),
 * and every stone's text from the catalog scan (Catalog 0.2.5+). Both beat
 * the reference line below.
 */

export interface MundusStone {
  name: string;
  /** Reference wording for what it boosts, as of Update 51. */
  boosts: string;
  /** False for stones whose blessing does nothing in combat. */
  combat: boolean;
}

export const MUNDUS_STONES: readonly MundusStone[] = [
  { name: "The Apprentice", boosts: "Experience and Inspiration gain", combat: false },
  { name: "The Atronach", boosts: "Magicka Recovery", combat: true },
  { name: "The Lady", boosts: "Physical and Spell Resistance", combat: true },
  { name: "The Lord", boosts: "Maximum Health", combat: true },
  { name: "The Lover", boosts: "Physical and Spell Penetration", combat: true },
  { name: "The Mage", boosts: "Maximum Magicka", combat: true },
  { name: "The Ritual", boosts: "Healing Done", combat: true },
  { name: "The Serpent", boosts: "Stamina Recovery", combat: true },
  { name: "The Shadow", boosts: "Critical Damage and Critical Healing", combat: true },
  { name: "The Steed", boosts: "Movement Speed and Health Recovery", combat: true },
  { name: "The Thief", boosts: "Critical Chance", combat: true },
  { name: "The Tower", boosts: "Maximum Stamina", combat: true },
  { name: "The Warrior", boosts: "Weapon and Spell Damage", combat: true },
];

export const TWICE_BORN_STAR = "Twice-Born Star";

const stoneKey = (raw: string | null | undefined) =>
  (raw ?? "").trim().toLowerCase().replace(/^boon:\s*/, "").replace(/^the\s+/, "");

export function findMundus(raw: string | null | undefined): MundusStone | null {
  const n = stoneKey(raw);
  if (!n) return null;
  return MUNDUS_STONES.find((s) => stoneKey(s.name) === n) ?? null;
}

/** The game's text for a blessing, from a saved buff or a catalog row. */
export interface MundusText {
  name: string;
  description?: string | null;
}

export interface ActiveBlessing {
  stone: MundusStone | null;
  /** The name as the game gave it, kept even when the reference list doesn't know it. */
  name: string;
  /** The game's own wording with this patch's numbers; null when nothing has reported it yet. */
  text: string | null;
  /** Where `text` came from. */
  textFrom: "buff" | "catalog" | null;
}

export interface MundusReading {
  /** The first blessing, for places that show one. */
  stone: MundusStone | null;
  blessings: ActiveBlessing[];
  /** How many blessings the gear allows: two with five Twice-Born Star pieces. */
  allowed: 1 | 2;
  /** Body armor pieces with the Divines trait, which strengthen the blessing. */
  divinesPieces: number;
  /** A second blessing would apply but only one is active. */
  secondBlessingFree: boolean;
}

export interface MundusInput {
  mundus?: string | null;
  mundusBoons?: readonly string[] | null;
  buffs?: readonly { name: string; mundus?: boolean | null; description?: string | null }[] | null;
}

export function readMundus(
  c: MundusInput,
  equipped: readonly (WornInput & { trait?: string | null })[],
  catalog: readonly MundusText[] = [],
): MundusReading {
  let twiceBorn = 0;
  let divines = 0;
  for (const e of equipped) {
    if ((e.setName ?? "").toLowerCase().includes(TWICE_BORN_STAR.toLowerCase())) twiceBorn += 1;
    const kind = parsePieceType(e.type) ?? pieceKindFromName(e.name);
    if (kind?.kind === "armor" && canonicalTrait(e.trait) === "Divines") divines += 1;
  }
  const names = c.mundusBoons?.length ? [...c.mundusBoons] : c.mundus ? [c.mundus] : [];
  const blessings = names.map((raw): ActiveBlessing => {
    const key = stoneKey(raw);
    const buff = (c.buffs ?? []).find((b) => b.mundus && stoneKey(b.name) === key && b.description);
    const row = catalog.find((m) => stoneKey(m.name) === key && m.description);
    const stone = findMundus(raw);
    return {
      stone,
      name: stone?.name ?? raw.replace(/^boon:\s*/i, "").trim(),
      text: buff?.description ?? row?.description ?? null,
      textFrom: buff?.description ? "buff" : row?.description ? "catalog" : null,
    };
  });
  const allowed = twiceBorn >= 5 ? 2 : 1;
  return {
    stone: blessings[0]?.stone ?? null,
    blessings,
    allowed,
    divinesPieces: divines,
    secondBlessingFree: allowed === 2 && blessings.length < 2,
  };
}
