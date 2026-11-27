/**
 * The transmute station's costs, in transmute crystals.
 *
 * Sources: the game's own station (reconstruction cost shown per piece) and
 * UESP Online:Transmutation.
 */

/**
 * Crystals to reconstruct one collected piece.
 *
 * The game's published curve: 75 when only one piece of the set is collected,
 * 25 when every piece is collected, and a straight line between those ends,
 * rounded down. A one-piece set (a mythic) is 25 as soon as it is collected.
 * Returns null when the piece is not collected or the snapshot has no total.
 */
export function reconstructionCost(collected: number, total: number): number | null {
  if (collected <= 0 || total <= 0) return null;
  if (total === 1 || collected >= total) return 25;
  return Math.floor(75 - (50 * (collected - 1)) / (total - 1));
}

/** Trait change at the transmute station. Fixed in the live game. */
export const TRAIT_CHANGE_CRYSTALS = 50;
