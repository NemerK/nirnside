import { effectsText } from "./stats";
import type { ActiveBuff } from "../snapshot/schema";

/**
 * Lasting effects on a character, as of the last save (addon 0.9.43+).
 *
 * The addon reads the character's buffs at logout or reload and keeps
 * those that last a minute or more: Mundus blessings, food and drink, and
 * other long effects. Each keeps its end time, so it counts down from the
 * save; after that time it has run out, whatever the character did since.
 *
 * Which buff is food isn't encoded: the game names food buffs by their
 * effect ("Increase Max Health & Magicka"), not by the dish, and reports no
 * link between them. Recorded for later in docs/notes.md.
 */

export interface BuffReading {
  name: string;
  icon: string | null;
  mundus: boolean;
  /** Seconds left now, counted from the save; null = lasts until removed. */
  remaining: number | null;
  expired: boolean;
  /** The game's text with this character's numbers (snapshot 0.9.46+, blessings before that). */
  description: string | null;
  /** What it adds to the stat sheet, in words ("+11% Critical Damage"). */
  amount: string | null;
}

export function readBuffs(buffs: readonly ActiveBuff[] | null | undefined, now: number): BuffReading[] {
  return (buffs ?? []).map((b) => {
    const remaining = b.endsAt == null ? null : Math.max(0, b.endsAt - now);
    return {
      name: b.name,
      icon: b.icon ?? null,
      mundus: b.mundus === true,
      remaining,
      expired: remaining === 0,
      description: b.description ?? null,
      amount: effectsText(b.effects),
    };
  });
}
