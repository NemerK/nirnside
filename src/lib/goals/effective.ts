import { goalAppliesTo } from "./progress";
import type { Goal, GoalDomain, GoalScope, GoalSubject } from "./types";

/**
 * Which saved target actually governs one character.
 *
 * Several targets can name the same thing (Assault for everyone, Assault for
 * one character). The most specific one wins: character over role/class over
 * account — the same rule the overlap notices describe when a target is set.
 * Equally specific targets both stand, so the one asking for more is the one
 * the character has to reach.
 */

export const SCOPE_SPECIFICITY: Record<GoalScope, number> = { account: 1, class: 2, role: 2, character: 3 };

function sameTarget(a: string, b: string): boolean {
  return a.trim().replace(/\s+/g, " ").toLowerCase() === b.trim().replace(/\s+/g, " ").toLowerCase();
}

function reach(goal: Goal): number {
  return Math.max(goal.targetRank, goal.extraRank);
}

export function effectiveGoal(goals: Goal[], subject: GoalSubject, domain: GoalDomain, target: string): Goal | null {
  let best: Goal | null = null;
  for (const goal of goals) {
    if (goal.domain !== domain) continue;
    if (!sameTarget(goal.target, target)) continue;
    if (!goalAppliesTo(goal, subject)) continue;
    if (!best) {
      best = goal;
      continue;
    }
    const spec = SCOPE_SPECIFICITY[goal.scope];
    const bestSpec = SCOPE_SPECIFICITY[best.scope];
    if (spec > bestSpec || (spec === bestSpec && reach(goal) > reach(best))) best = goal;
  }
  return best;
}

/** True when `goal` is the target that governs this character. */
export function governs(goal: Goal, goals: Goal[], subject: GoalSubject): boolean {
  return effectiveGoal(goals, subject, goal.domain, goal.target)?.id === goal.id;
}
