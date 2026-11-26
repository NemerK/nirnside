import { effectiveGoal } from "./effective";
import { abilityTitle, skillLineTitle, type Goal, type GoalScope, type GoalSubject } from "./types";
import type { GoalCardView, GoalMarkView } from "./views";

/**
 * The Targets page: each saved target once, with only the characters it
 * actually governs. Someone covered by a more specific target is listed as
 * "uses their own target" instead of being counted short twice.
 */

export interface ReviewPerson {
  id: string;
  name: string;
  className: string;
  mark: GoalMarkView;
}

export interface ReviewOverride {
  id: string;
  name: string;
  /** The target that governs them instead, e.g. "Assault 4". */
  by: string;
  byGoalId: string;
}

export interface ReviewTarget {
  goal: Goal;
  title: string;
  /** Who the target is for, e.g. "Everyone", "Every Templar", "Tanks", "Draugr-Bane". */
  audience: string;
  people: ReviewPerson[];
  overridden: ReviewOverride[];
  done: number;
  /** Characters with a known result: done + short + not found yet. */
  known: number;
  /** Characters not snapshotted yet, who can't be judged. */
  unknown: number;
  complete: boolean;
}

export interface ReviewGroup {
  scope: GoalScope;
  title: string;
  targets: ReviewTarget[];
}

export function targetTitle(goal: Goal): string {
  if (goal.domain === "skillline") return skillLineTitle(goal);
  if (goal.domain === "ability") return abilityTitle(goal);
  return goal.target;
}

export function audienceOf(
  goal: Pick<Goal, "scope" | "characterId" | "scopeKey">,
  subjects: Pick<GoalSubject, "id" | "name">[],
  roles: { id: string; name: string }[],
): string {
  switch (goal.scope) {
    case "account":
      return "Everyone";
    case "class":
      return `Every ${goal.scopeKey ?? "class"}`;
    case "role":
      return roles.find((r) => r.id === goal.scopeKey)?.name ?? "A role that no longer exists";
    case "character":
      return subjects.find((s) => s.id === goal.characterId)?.name ?? "A character no longer on the roster";
  }
}

const GROUP_TITLE: Record<GoalScope, string> = {
  account: "For everyone",
  class: "For a class",
  role: "For a role",
  character: "For one character",
};

const GROUP_ORDER: GoalScope[] = ["account", "class", "role", "character"];

export function reviewTargets(input: {
  goals: Goal[];
  cards: GoalCardView[];
  subjects: GoalSubject[];
  roles: { id: string; name: string }[];
}): ReviewGroup[] {
  const byId = new Map(input.subjects.map((s) => [s.id, s]));
  const targets: ReviewTarget[] = input.cards.map((card) => {
    const people: ReviewPerson[] = [];
    const overridden: ReviewOverride[] = [];
    for (const row of card.rows) {
      const subject = byId.get(row.id);
      if (!subject) continue;
      const winner = effectiveGoal(input.goals, subject, card.goal.domain, card.goal.target);
      if (winner && winner.id !== card.goal.id) {
        overridden.push({ id: subject.id, name: subject.name, by: targetTitle(winner), byGoalId: winner.id });
      } else {
        people.push({ id: subject.id, name: subject.name, className: subject.className, mark: row.mark });
      }
    }
    // Unfinished first, so the work is at the top of each card.
    const order: Record<string, number> = { short: 0, undiscovered: 1, unknown: 2, done: 3 };
    people.sort((a, b) => (order[a.mark.state] ?? 9) - (order[b.mark.state] ?? 9));
    const done = people.filter((p) => p.mark.state === "done").length;
    const unknown = people.filter((p) => p.mark.state === "unknown").length;
    const known = people.length - unknown;
    return {
      goal: card.goal,
      title: targetTitle(card.goal),
      audience: audienceOf(card.goal, input.subjects, input.roles),
      people,
      overridden,
      done,
      known,
      unknown,
      complete: known > 0 && done === known && unknown === 0,
    };
  });

  return GROUP_ORDER.map((scope) => ({
    scope,
    title: GROUP_TITLE[scope],
    targets: targets
      .filter((t) => t.goal.scope === scope)
      .sort((a, b) => Number(a.complete) - Number(b.complete) || a.title.localeCompare(b.title)),
  })).filter((g) => g.targets.length > 0);
}
