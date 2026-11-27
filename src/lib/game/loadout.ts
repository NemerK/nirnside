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
 * - Armor passives depend on how many body pieces of each weight are worn
 *   (seven body slots; a shield is not body armor).
 *
 * When the addon reports the game's own count for a set (newer scans), that
 * number is kept beside ours as `gameCount`, so rules the model doesn't
 * encode (such as how perfected and normal pieces combine) come from the game.
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
  /** The game's count for this item's set on the active bar, when reported. */
  gameCount: number | null;
  gamePerfectedCount: number | null;
}

export interface WornSet {
  setId: number | null;
  name: string;
  front: number;
  back: number;
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
    gameCount: e.setCount ?? null,
    gamePerfectedCount: e.setPerfectedCount ?? null,
  };
}

export function loadoutOf(equipped: readonly WornInput[]): Loadout {
  const pieces = equipped.map(readWornPiece);
  const armorWeights = Object.fromEntries(WEIGHTS.map((w) => [w, 0])) as Record<Weight, number>;
  for (const p of pieces) if (p.kind?.kind === "armor" && p.bar == null) armorWeights[p.kind.weight] += 1;

  const sets = new Map<string, WornSet>();
  for (const p of pieces) {
    if (!p.setName && p.setId == null) continue;
    const key = p.setId != null ? `id:${p.setId}` : `name:${p.setName!.toLowerCase()}`;
    const s = sets.get(key) ?? {
      setId: p.setId,
      name: p.setName ?? "",
      front: 0,
      back: 0,
      gameCount: null,
      gamePerfectedCount: null,
    };
    if (!s.name && p.setName) s.name = p.setName;
    if (p.bar !== "back") s.front += p.weight;
    if (p.bar !== "front") s.back += p.weight;
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

/** Pieces of a set worn on a bar (body pieces count on both). */
export function setCountOnBar(loadout: Loadout, setName: string, bar: Bar): number {
  const s = loadout.sets.find((x) => x.name.toLowerCase() === setName.trim().toLowerCase());
  return s ? s[bar] : 0;
}

/** Bonuses active for a worn count: every bonus up to it. */
export function activeBonuses<B extends { pieces: number }>(bonuses: readonly B[], worn: number): B[] {
  return bonuses.filter((b) => b.pieces <= worn);
}
