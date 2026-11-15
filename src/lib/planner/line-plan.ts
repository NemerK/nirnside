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

function passiveKeys(skills: LineSkillView[]): Set<string> {
  const keys = new Set<string>();
  for (const skill of skills) {
    if (!skill.passive) continue;
    for (const name of [skill.name, ...skill.morphs]) keys.add(name.trim().toLowerCase());
  }
  return keys;
}

/**
 * Active abilities to show when a character opens a skill-line target.
 * Passives are omitted: they unlock with the line's rank, so they are not
 * separate work. Planned abilities win. When none are planned and the
 * mandatory rank is the line's own maximum, every active ability counts as
 * mandatory.
 */
export function skillsForLinePlan(opts: {
  skills: LineSkillView[];
  plans: AbilityPlan[];
  lineName: string;
  mandatoryRank: number;
  maxRank: number | null;
  tier: GoalTier;
}): { implied: boolean; skills: ShownSkill[] } {
  const passives = passiveKeys(opts.skills);
  const actives = opts.skills.filter((skill) => !skill.passive);
  const linePlans = opts.plans.filter((plan) => same(plan.lineName, opts.lineName));
  const planned = linePlans.filter((plan) => !passives.has(plan.target.trim().toLowerCase()));
  if (linePlans.length === 0) {
    const atMax = opts.tier === "essential" && opts.maxRank != null && opts.maxRank > 0 && opts.mandatoryRank >= opts.maxRank;
    if (!atMax) return { implied: false, skills: [] };
    return {
      implied: true,
      skills: actives.map((skill) => ({
        name: skill.name,
        icon: skill.icon,
        passive: false,
        purchased: skill.purchased,
        tier: "essential",
        implied: true,
      })),
    };
  }
  if (planned.length === 0) return { implied: false, skills: [] };

  const used = new Set<string>();
  const shown: ShownSkill[] = [];
  for (const skill of actives) {
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
