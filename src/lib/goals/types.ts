/** Player-authored planning targets. Not game data; stored only locally. */

export type GoalDomain = "skillline" | "ability" | "script";
export type GoalTier = "essential" | "optional" | "completionist";
export type GoalScope = "account" | "character" | "role" | "class";

export interface Goal {
  id: string;
  domain: GoalDomain;
  tier: GoalTier;
  /** account = every live character; role/class/character narrow it down. */
  scope: GoalScope;
  /** scope=character → the character id; null otherwise. */
  characterId: string | null;
  /** scope=role → the role id; scope=class → the class name; null otherwise. */
  scopeKey: string | null;
  /** Skill line name, ability (or morph) name, or scribing script name. */
  target: string;
  /**
   * Mandatory skill-line rank. 0 when the line has only an extra rank.
   * 0 for ability and script goals.
   */
  targetRank: number;
  /**
   * Extra skill-line rank, strictly above `targetRank`. 0 when unset.
   * The extra segment of the planner bar never sits below mandatory.
   */
  extraRank: number;
  note: string;
  createdAt: number;
}

export interface SkillLineChoice {
  name: string;
  category: string;
  /** Live rank cap. Null when this line is not a rank line or the cap is unknown. */
  maxRank?: number | null;
}

/** How a skill-line target reads in lists: "Assault 7" or "Assault 7–10". */
export function skillLineTitle(goal: {
  target: string;
  targetRank: number;
  extraRank?: number;
  tier?: string;
}): string {
  const extraField = goal.extraRank ?? 0;
  const mandatory = goal.targetRank;
  if (mandatory > 0 && extraField > mandatory) return `${goal.target} ${mandatory}–${extraField}`;
  if ((goal.tier === "optional" || goal.tier === "completionist") && extraField === 0 && mandatory > 0) {
    return `${goal.target} extra ${mandatory}`;
  }
  if (mandatory > 0) return `${goal.target} ${mandatory}`;
  if (extraField > 0) return `${goal.target} extra ${extraField}`;
  return goal.target;
}

export interface GoalSubjectAbility {
  name: string;
  purchased: boolean;
  /** Morph names this ability has (any morph slot). */
  morphNames: string[];
  /** Morph names the character actually owns. */
  morphPurchased: string[];
}

export interface GoalSubjectLine {
  name: string;
  rank: number;
  abilities: GoalSubjectAbility[];
}

/**
 * One character, flattened for goal progress. `full` marks a subject built
 * from a complete snapshot (abilities + scribing): roster rows strip those, so
 * ability/script progress must read unknown there, never "missing".
 */
export interface GoalSubject {
  id: string;
  name: string;
  className: string;
  lastSeen: number | null;
  skillLines: GoalSubjectLine[];
  scribingScripts: string[];
  isVampire: boolean;
  isWerewolf: boolean;
  /** Role ids assigned to this character (player-authored roles). */
  roleIds: string[];
  full: boolean;
}

/** Catalog line metadata for class-validity guards, keyed by lowercase name. */
export interface LineMeta {
  category: string;
  className: string | null;
}

/** Catalog ability metadata for class-validity guards, keyed by lowercase name. */
export interface AbilityMeta {
  lineName: string;
  category: string;
  className: string | null;
}

export interface GoalIndexes {
  /** lowercase skill line name → catalog metadata. */
  lines?: Map<string, LineMeta>;
  /** lowercase ability/morph name → catalog metadata. */
  abilities?: Map<string, AbilityMeta>;
}

export type LineProgress =
  | { state: "done"; rank: number }
  | { state: "short"; rank: number }
  | { state: "undiscovered" }
  | { state: "unknown" }
  | { state: "notapplicable"; reason?: string };

export const TIERS: GoalTier[] = ["essential", "optional", "completionist"];

export const TIER_LABEL: Record<GoalTier, string> = {
  essential: "Mandatory",
  optional: "Extra",
  completionist: "Completionist",
};

/** The class-specific line categories — guarded, never "missing" cross-class. */
export const CLASS_LINE_CATEGORIES = new Set(["class", "class mastery"]);
