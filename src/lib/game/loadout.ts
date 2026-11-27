import {
  TWO_HANDED,
  WEIGHTS,
  parsePieceType,
  parseWornSlot,
  pieceKindFromName,
  type PieceKind,
  type Weight,
  type WornSlot,
} from "./equipment";

/**
 * How a character's worn gear works together, by the game's rules:
 *
 * - Body armor and jewelry count toward the sets on both weapon bars; each
 *   bar's weapons count only while that bar is out.
 * - A two-handed weapon (greatsword, battle axe, maul, bow, any staff)
 *   counts as two pieces of its set.
 * - A set grants every bonus up to the number of pieces worn.
 * - Perfected and normal pieces are one set when worn. Every piece, perfected
 *   or not, counts toward the normal bonuses; the perfected bonus line counts
 *   only perfected pieces. So four perfected pieces and one normal give the
 *   full set except the perfected bonus. (They are collected separately: the
 *   normal piece drops in veteran, the perfected one in veteran hard mode.)
 *   Source: the owner, and the game's own tooltip (ZO_Tooltip:AddSet compares
 *   a line flagged perfected by GetItemLinkSetBonusInfo with the perfected
 *   count from GetItemLinkSetInfo, and every other line with the full count).
 * - Armor passives depend on how many body pieces of each weight are worn
 *   (seven body slots; a shield is not body armor).
 *
 * When the addon reports the game's own count for a set (newer scans), that
 * number is kept beside ours as `gameCount` and `gamePerfectedCount`; the
 * game's counts are for the bar that was out at the save.
 */

export type Bar = "front" | "back";

export interface WornPiece {
  slot: WornSlot | null;
  /** The weapon bar, for weapons; null for body armor and jewelry. */
  bar: Bar | null;
  kind: PieceKind | null;
  setId: number | null;
  setName: string | null;
  /** How many set pieces this item is worth: 2 for a two-hander. */
  weight: number;
  /** A perfected piece ("Perfected …"), which also counts toward the perfected bonus. */
  perfected: boolean;
  /** The game's count for this item's set on the active bar, when reported. */
  gameCount: number | null;
  gamePerfectedCount: number | null;
}

export interface WornSet {
  setId: number | null;
  /** The set's name without "Perfected". */
  name: string;
  /** All pieces of the set, perfected or not, per bar. */
  front: number;
  back: number;
  /** Perfected pieces only, per bar. */
  perfectedFront: number;
  perfectedBack: number;
  gameCount: number | null;
  gamePerfectedCount: number | null;
}

export interface Loadout {
  pieces: WornPiece[];
  /** Body armor pieces per weight. */
  armorWeights: Record<Weight, number>;
  sets: WornSet[];
}

export interface WornInput {
  slot: string;
  bar?: "front" | "back" | null;
  name?: string | null;
  type?: string | null;
  setId?: number | null;
  setName?: string | null;
  setCount?: number | null;
  setPerfectedCount?: number | null;
}

export function readWornPiece(e: WornInput): WornPiece {
  const slot = parseWornSlot(e.slot);
  const kind = parsePieceType(e.type) ?? pieceKindFromName(e.name);
  const weapon = kind?.kind === "weapon" ? kind.weapon : null;
  const isWeaponSlot = slot === "mainhand" || slot === "offhand";
  const bar: Bar | null = e.bar ?? (isWeaponSlot || weapon ? (/back/i.test(e.slot) ? "back" : "front") : null);
  return {
    slot,
    bar,
    kind,
    setId: e.setId ?? null,
    setName: e.setName?.trim() || null,
    weight: weapon && TWO_HANDED.has(weapon) ? 2 : slot === "poison" ? 0 : 1,
    perfected: isPerfectedName(e.setName),
    gameCount: e.setCount ?? null,
    gamePerfectedCount: e.setPerfectedCount ?? null,
  };
}

const PERFECTED = /^perfected\s+/i;

export function isPerfectedName(setName: string | null | undefined): boolean {
  return PERFECTED.test((setName ?? "").trim());
}

/** "Perfected Slivers of the Null Arca" → "Slivers of the Null Arca". */
export function baseSetName(setName: string): string {
  return setName.trim().replace(PERFECTED, "");
}

export function loadoutOf(equipped: readonly WornInput[]): Loadout {
  const pieces = equipped.map(readWornPiece);
  const armorWeights = Object.fromEntries(WEIGHTS.map((w) => [w, 0])) as Record<Weight, number>;
  for (const p of pieces) if (p.kind?.kind === "armor" && p.bar == null) armorWeights[p.kind.weight] += 1;

  const sets = new Map<string, WornSet>();
  for (const p of pieces) {
    if (!p.setName && p.setId == null) continue;
    // Perfected and normal versions have their own set ids, so they meet by name.
    const key = p.setName ? `name:${baseSetName(p.setName).toLowerCase()}` : `id:${p.setId}`;
    const s = sets.get(key) ?? {
      setId: null,
      name: p.setName ? baseSetName(p.setName) : "",
      front: 0,
      back: 0,
      perfectedFront: 0,
      perfectedBack: 0,
      gameCount: null,
      gamePerfectedCount: null,
    };
    if (!s.name && p.setName) s.name = baseSetName(p.setName);
    // The normal version's id names the set; a perfected id stands in until one is seen.
    if (!p.perfected && p.setId != null) s.setId = p.setId;
    else s.setId ??= p.setId;
    if (p.bar !== "back") s.front += p.weight;
    if (p.bar !== "front") s.back += p.weight;
    if (p.perfected && p.bar !== "back") s.perfectedFront += p.weight;
    if (p.perfected && p.bar !== "front") s.perfectedBack += p.weight;
    s.gameCount ??= p.gameCount;
    s.gamePerfectedCount ??= p.gamePerfectedCount;
    sets.set(key, s);
  }
  return {
    pieces,
    armorWeights,
    sets: [...sets.values()].sort((a, b) => Math.max(b.front, b.back) - Math.max(a.front, a.back) || a.name.localeCompare(b.name)),
  };
}

/** Pieces of a set worn on a bar (body pieces count on both), perfected included. */
export function setCountOnBar(loadout: Loadout, setName: string, bar: Bar): number {
  const s = loadout.sets.find((x) => x.name.toLowerCase() === baseSetName(setName).toLowerCase());
  return s ? s[bar] : 0;
}

/** Perfected pieces of a set worn on a bar. */
export function perfectedCountOnBar(loadout: Loadout, setName: string, bar: Bar): number {
  const s = loadout.sets.find((x) => x.name.toLowerCase() === baseSetName(setName).toLowerCase());
  return s ? (bar === "front" ? s.perfectedFront : s.perfectedBack) : 0;
}

/**
 * Bonuses active for what's worn: every normal bonus up to the full count,
 * and the perfected line only once that many perfected pieces are worn.
 */
export function activeBonuses<B extends { pieces: number; perfected?: boolean | null }>(
  bonuses: readonly B[],
  worn: number,
  perfectedWorn = 0,
): B[] {
  return bonuses.filter((b) => b.pieces <= (b.perfected ? perfectedWorn : worn));
}
