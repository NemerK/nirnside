/**
 * Champion Points (CP 2.0, Update 29; refined since). Sources: UESP
 * Online:Champion and the Update 29 notes.
 *
 * - Three constellations: Craft (green, the Thief), Warfare (blue, the
 *   Mage), Fitness (red, the Warrior).
 * - Points are earned account-wide, one at a time in turn: Craft, then
 *   Warfare, then Fitness. Every character spends them on its own.
 * - At most 3600 can be spent, 1200 per constellation.
 * - Stars are slottable (work only while slotted on the Champion Bar),
 *   passive (work once points are in them) or cluster roots (lead into
 *   sub-constellations). The bar has twelve slots, four per constellation.
 * - Since Update 45 several Craft stars that used to need slotting are
 *   passive.
 *
 * Each star's name, type and maximum points come from the in-game catalog
 * scan; the scan of a character says what is spent and slotted.
 */

export const CONSTELLATIONS = ["Craft", "Warfare", "Fitness"] as const;
export type Constellation = (typeof CONSTELLATIONS)[number];

export const CONSTELLATION_INFO: Record<Constellation, { color: string; guardian: string; focus: string }> = {
  Craft: { color: "green", guardian: "The Thief", focus: "Crafting, gathering, stealth, thievery and comfort" },
  Warfare: { color: "blue", guardian: "The Mage", focus: "Damage, healing and mitigation" },
  Fitness: { color: "red", guardian: "The Warrior", focus: "Survival, recovery, blocking, movement and PvP defence" },
};

export const CP_CAP = 3600;
export const CP_PER_CONSTELLATION = 1200;
export const SLOTS_PER_CONSTELLATION = 4;

export type StarType = "slottable" | "passive" | "cluster";

export function findConstellation(raw: string | null | undefined): Constellation | null {
  const n = (raw ?? "").trim().toLowerCase();
  if (/craft|green|thief/.test(n)) return "Craft";
  if (/warfare|blue|mage/.test(n)) return "Warfare";
  if (/fitness|red|warrior/.test(n)) return "Fitness";
  return null;
}

/**
 * How earned points split across the constellations: they arrive in turn,
 * Craft first, and stop counting at the cap.
 */
export function earnedPerConstellation(earned: number): Record<Constellation, number> {
  const total = Math.max(0, Math.min(earned, CP_CAP));
  const base = Math.floor(total / 3);
  const extra = total % 3;
  return { Craft: base + (extra > 0 ? 1 : 0), Warfare: base + (extra > 1 ? 1 : 0), Fitness: base };
}

export interface ScannedDiscipline {
  name: string;
  stars: { name: string; points: number; slotted: boolean; kind?: StarType }[];
}

export interface ConstellationState {
  constellation: Constellation;
  spent: number;
  slotted: string[];
  freeSlots: number;
  /** Stars with points in them that only work slotted, and aren't. */
  idleSlottables: string[];
}

/** A character's CP, per constellation: spent, slotted, open slots, points sitting in unslotted slottables. */
export function championState(disciplines: readonly ScannedDiscipline[]): ConstellationState[] {
  return CONSTELLATIONS.map((constellation) => {
    const d = disciplines.find((x) => findConstellation(x.name) === constellation);
    const stars = d?.stars ?? [];
    const slotted = stars.filter((s) => s.slotted).map((s) => s.name);
    return {
      constellation,
      spent: stars.reduce((n, s) => n + (s.points || 0), 0),
      slotted,
      freeSlots: Math.max(0, SLOTS_PER_CONSTELLATION - slotted.length),
      idleSlottables: stars.filter((s) => s.kind === "slottable" && !s.slotted && s.points > 0).map((s) => s.name),
    };
  });
}
