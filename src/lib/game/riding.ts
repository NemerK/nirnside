import type { Riding } from "../snapshot/schema";

/**
 * Riding lessons. Source: UESP Online:Stablemaster.
 *
 * - Three skills trained at a stablemaster: speed, stamina and carrying
 *   capacity. Each lesson raises one skill by 1, and a skill's cap is the
 *   one the game reports (60 on live).
 * - One lesson per character, then a cooldown (about 20 hours on live).
 *   The addon records when the next lesson opens, so Nirnside counts down
 *   from the save instead of assuming the cooldown.
 */

export interface RidingReading {
  speed: { now: number; max: number | null };
  stamina: { now: number; max: number | null };
  capacity: { now: number; max: number | null };
  /** Every skill at its cap: nothing left to train. */
  complete: boolean;
  /** A lesson can be taken now (as far as the last save says). Null when unknown. */
  lessonReady: boolean | null;
  /** Seconds until the next lesson, counted from the save; null when unknown or complete. */
  lessonIn: number | null;
}

export function readRiding(r: Riding | null | undefined, now: number): RidingReading | null {
  if (!r) return null;
  const skill = (v: number | null | undefined, max: number | null | undefined) => ({ now: v ?? 0, max: max ?? null });
  const speed = skill(r.speed, r.maxSpeed);
  const stamina = skill(r.stamina, r.maxStamina);
  const capacity = skill(r.capacity, r.maxCapacity);
  const parts = [speed, stamina, capacity];
  const complete = parts.every((p) => p.max != null && p.now >= p.max);
  const left = r.trainableAt == null ? null : Math.max(0, r.trainableAt - now);
  return {
    speed,
    stamina,
    capacity,
    complete,
    lessonReady: complete ? false : left == null ? null : left === 0,
    lessonIn: complete || left == null || left === 0 ? null : left,
  };
}
