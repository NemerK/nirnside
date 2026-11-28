import { CONSTELLATIONS, findConstellation, type Constellation } from "../game/champion";
import { isTradeskill, type Tradeskill } from "../game/tradeskills";

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

/**
 * One hue per craft, so a plan's station reads at a glance. The Party look
 * sets the --craft-* tokens; the fallbacks are for the Atlas look.
 */
export const TRADESKILL_COLOR: Record<Tradeskill, string> = {
  blacksmithing: "var(--craft-blacksmithing, #9fb1c4)",
  clothing: "var(--craft-clothing, #c9a27e)",
  woodworking: "var(--craft-woodworking, #8fbf6e)",
  enchanting: "var(--craft-enchanting, #7f9cff)",
  alchemy: "var(--craft-alchemy, #e486ad)",
  provisioning: "var(--craft-provisioning, #ea9461)",
  jewelry: "var(--craft-jewelry, #62c9c3)",
};

export function tradeskillColor(craft: string | null | undefined): string | undefined {
  return isTradeskill(craft) ? TRADESKILL_COLOR[craft] : undefined;
}
