import type { GoalTier } from "../goals/types";

/** One skill on a line, as the character sheet modal needs it. */
export interface LineSkillView {
  name: string;
  icon: string | null;
  passive: boolean;
  purchased: boolean | null;
  morphs: string[];
}

/** An ability target that applies to this character and belongs to a line. */
export interface AbilityPlan {
  target: string;
  tier: GoalTier;
  lineName: string;
}

export interface ShownSkill {
  name: string;
  icon: string | null;
  passive: boolean;
  purchased: boolean | null;
  tier: GoalTier;
  /** True when the skill was not planned on its own; the line's mandatory rank is the cap. */
  implied: boolean;
}

const TIER_RANK: Record<GoalTier, number> = {
  essential: 0,
  optional: 1,
  completionist: 2,
};

function same(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function stronger(a: GoalTier, b: GoalTier): GoalTier {
  return TIER_RANK[a] <= TIER_RANK[b] ? a : b;
}

/**
 * Skills to show when a character opens a skill-line target.
 * Planned abilities win. When none are planned and the mandatory rank is the
 * line's own maximum, every skill on the line counts as mandatory.
 */
export function skillsForLinePlan(opts: {
  skills: LineSkillView[];
  plans: AbilityPlan[];
  lineName: string;
  mandatoryRank: number;
  maxRank: number | null;
  tier: GoalTier;
}): { implied: boolean; skills: ShownSkill[] } {
  const planned = opts.plans.filter((plan) => same(plan.lineName, opts.lineName));
  if (planned.length === 0) {
    const atMax = opts.tier === "essential" && opts.maxRank != null && opts.maxRank > 0 && opts.mandatoryRank >= opts.maxRank;
    if (!atMax) return { implied: false, skills: [] };
    return {
      implied: true,
      skills: opts.skills.map((skill) => ({
        name: skill.name,
        icon: skill.icon,
        passive: skill.passive,
        purchased: skill.purchased,
        tier: "essential",
        implied: true,
      })),
    };
  }

  const used = new Set<string>();
  const shown: ShownSkill[] = [];
  for (const skill of opts.skills) {
    const names = [skill.name, ...skill.morphs];
    const hits = planned.filter((plan) => names.some((name) => same(name, plan.target)));
    if (hits.length === 0) continue;
    const tier = hits.reduce<GoalTier>((best, hit) => stronger(best, hit.tier), hits[0]!.tier);
    const morph = hits.find((hit) => !same(hit.target, skill.name));
    shown.push({
      name: hits.length === 1 && morph ? morph.target : skill.name,
      icon: skill.icon,
      passive: skill.passive,
      purchased: skill.purchased,
      tier,
      implied: false,
    });
    for (const hit of hits) used.add(hit.target.trim().toLowerCase());
  }
  for (const plan of planned) {
    if (used.has(plan.target.trim().toLowerCase())) continue;
    shown.push({
      name: plan.target,
      icon: null,
      passive: false,
      purchased: null,
      tier: plan.tier,
      implied: false,
    });
  }
  return { implied: false, skills: shown };
}
