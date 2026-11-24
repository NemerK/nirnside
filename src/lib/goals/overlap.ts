import { abilityTitle, skillLineTitle, type Goal, type GoalDomain, type GoalScope } from "./types";

/**
 * A new plan overlaps an older one when they ask for the same thing and at
 * least one character is covered by both. The notice says what the older plan
 * is and whether it is account-wide or character-specific.
 */

export interface OverlapAudience {
  scope: GoalScope;
  characterId: string | null;
  scopeKey: string | null;
}

export interface OverlapPerson {
  id: string;
  name: string;
  className: string;
  roleIds: string[];
}

export interface OverlapNotice {
  goalId: string;
  /** The existing plan, e.g. "Assault 7" or "Assault 7–10". */
  what: string;
  /** account-wide, character-specific, class-specific, or role-specific. */
  reach: "account-wide" | "character-specific" | "class-specific" | "role-specific";
  /** Who that reach names, when it is not the whole account. */
  detail: string | null;
  /**
   * overrides — the new plan replaces the older one for the people they share.
   * kept — the older plan is more specific and still applies.
   * both — neither plan covers a smaller group, so both stay.
   */
  relation: "overrides" | "kept" | "both";
  sentence: string;
}

const SPECIFICITY: Record<GoalScope, number> = {
  account: 1,
  class: 2,
  role: 2,
  character: 3,
};

function sameAudience(a: OverlapAudience, b: OverlapAudience): boolean {
  if (a.scope !== b.scope) return false;
  if (a.scope === "account") return true;
  if (a.scope === "character") return (a.characterId ?? "") === (b.characterId ?? "");
  return (a.scopeKey ?? "").trim().toLowerCase() === (b.scopeKey ?? "").trim().toLowerCase();
}

function covers(audience: OverlapAudience, person: OverlapPerson): boolean {
  switch (audience.scope) {
    case "account":
      return true;
    case "character":
      return audience.characterId === person.id;
    case "class":
      return person.className.trim().toLowerCase() === (audience.scopeKey ?? "").trim().toLowerCase();
    case "role":
      return person.roleIds.includes(audience.scopeKey ?? "");
  }
}

function sharesSomeone(next: OverlapAudience, existing: OverlapAudience, people: OverlapPerson[]): boolean {
  if (people.length === 0) {
    if (next.scope === "account" || existing.scope === "account") return true;
    return sameAudience(next, existing);
  }
  return people.some((person) => covers(next, person) && covers(existing, person));
}

function planWhat(goal: Goal): string {
  if (goal.domain === "skillline") return skillLineTitle(goal);
  if (goal.domain === "ability") return abilityTitle(goal);
  return goal.target;
}

function reachOf(goal: Goal): OverlapNotice["reach"] {
  if (goal.scope === "account") return "account-wide";
  if (goal.scope === "character") return "character-specific";
  if (goal.scope === "class") return "class-specific";
  return "role-specific";
}

function detailOf(
  goal: Goal,
  people: OverlapPerson[],
  roles: { id: string; name: string }[],
): string | null {
  if (goal.scope === "account") return null;
  if (goal.scope === "character") {
    return people.find((person) => person.id === goal.characterId)?.name ?? "One character";
  }
  if (goal.scope === "class") return goal.scopeKey;
  return roles.find((role) => role.id === goal.scopeKey)?.name ?? "A role";
}

function named(reach: OverlapNotice["reach"], detail: string | null): string {
  if (reach === "account-wide") return "account-wide";
  return `${reach} (${detail ?? "unnamed"})`;
}

function sentenceFor(
  relation: OverlapNotice["relation"],
  what: string,
  reach: OverlapNotice["reach"],
  detail: string | null,
  next: OverlapAudience,
  people: OverlapPerson[],
  roles: { id: string; name: string }[],
  active: boolean,
): string {
  const older = `${what}. That plan is ${named(reach, detail)}`;
  if (relation === "kept") {
    return active
      ? `Not replacing ${older}, and it still applies.`
      : `A rank here would not replace ${older}. It would still apply.`;
  }
  if (relation === "both") {
    return active
      ? `Also overlapping ${older}. Both plans stay.`
      : `A rank here would also overlap ${older}. Both plans would stay.`;
  }
  const lead = active ? "Overriding" : "A rank here overrides";
  if (reach === "account-wide" && next.scope !== "account") {
    const who =
      next.scope === "character"
        ? (people.find((person) => person.id === next.characterId)?.name ?? "This character")
        : next.scope === "class"
          ? (next.scopeKey ?? "This class")
          : (roles.find((role) => role.id === next.scopeKey)?.name ?? "That role");
    const uses = active ? "uses this plan instead" : "would use this plan instead";
    return `${lead} ${older}. ${who} ${uses}. Everyone else keeps the account-wide plan.`;
  }
  return `${lead} ${older}.`;
}

export function overlapNotices(input: {
  domain: GoalDomain;
  target: string;
  next: OverlapAudience;
  goals: Goal[];
  people: OverlapPerson[];
  roles?: { id: string; name: string }[];
  /** False while the new rank is still empty, so the notice is a warning before the save. */
  active?: boolean;
}): OverlapNotice[] {
  const target = input.target.trim().toLowerCase();
  if (!target) return [];
  const roles = input.roles ?? [];
  const notices: OverlapNotice[] = [];
  for (const goal of input.goals) {
    if (goal.domain !== input.domain) continue;
    if (goal.target.trim().toLowerCase() !== target) continue;
    const existing: OverlapAudience = {
      scope: goal.scope,
      characterId: goal.characterId,
      scopeKey: goal.scopeKey,
    };
    if (sameAudience(input.next, existing)) continue;
    if (!sharesSomeone(input.next, existing, input.people)) continue;
    const nextSpec = SPECIFICITY[input.next.scope];
    const oldSpec = SPECIFICITY[goal.scope];
    const relation: OverlapNotice["relation"] =
      nextSpec > oldSpec ? "overrides" : nextSpec < oldSpec ? "kept" : "both";
    const what = planWhat(goal);
    const reach = reachOf(goal);
    const detail = detailOf(goal, input.people, roles);
    notices.push({
      goalId: goal.id,
      what,
      reach,
      detail,
      relation,
      sentence: sentenceFor(relation, what, reach, detail, input.next, input.people, roles, input.active !== false),
    });
  }
  return notices;
}
