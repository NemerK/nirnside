import { CONSTELLATIONS, findConstellation, type Constellation } from "../game/champion";

/**
 * Theme colors for the game's constellations (CONSTELLATION_INFO: green
 * Craft, blue Warfare, red Fitness). The Party look sets the --cp-*
 * tokens; the fallbacks are the Atlas look's colors.
 */
export const CONSTELLATION_COLOR: Record<Constellation, string> = {
  Craft: "var(--cp-craft, #3dce7a)",
  Warfare: "var(--cp-warfare, #4c9dff)",
  Fitness: "var(--cp-fitness, #e15b4a)",
};

export function constellationColor(name: string | null | undefined): string | undefined {
  const c = findConstellation(name);
  return c ? CONSTELLATION_COLOR[c] : undefined;
}

/** Sort key in the game's order (Craft, Warfare, Fitness); unknown names last. */
export function constellationRank(name: string | null | undefined): number {
  const c = findConstellation(name);
  return c ? CONSTELLATIONS.indexOf(c) : CONSTELLATIONS.length;
}
