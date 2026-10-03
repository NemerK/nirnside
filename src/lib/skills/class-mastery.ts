/**
 * Update 50 Class Mastery — a per-class skill line of five passives.
 *
 * Live rules (in-game / official Season Zero notes):
 *   - Unlocked when all three native class skill lines are rank 50 and the
 *     character is not subclassing.
 *   - Hidden (and purchases refunded) while any native line is swapped out.
 *   - Two Class Mastery Points, distinct from skill points; each passive costs 1.
 *   - Greyed out on characters who have not unlocked it yet.
 *
 * Purchases do not use regular skill-point ranks, so a bought passive can
 * report rank 0. Ownership is the `purchased` flag the addon reads from the
 * game, not a rank I+ check.
 */

export const CLASS_MASTERY_LINE_NAME = "Class Mastery";
export const CLASS_MASTERY_POINTS = 2;

export function isClassMasteryLineName(name: string | null | undefined): boolean {
  return (name ?? "").trim().toLowerCase() === CLASS_MASTERY_LINE_NAME.toLowerCase();
}

export function classMasteryPointsSpent(purchasedPassives: number): number {
  return Math.max(0, purchasedPassives);
}
