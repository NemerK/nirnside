import { romanRank } from "../skills/ability";

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
   * Skill-line mandatory rank, or the ability/morph rank to reach.
   * 0 on a skill line means "mandatory unset" (extra may still be set).
   * 0 on an ability means the live cap: IV for an active or morph, or the
   * passive's own cap from the snapshot. Scripts stay 0.
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

/** How an ability target reads: "Render Flesh IV", or the name when the target is the live cap. */
export function abilityTitle(goal: { target: string; targetRank: number }): string {
  if (goal.targetRank > 0) return `${goal.target} ${romanRank(goal.targetRank)}`;
  return goal.target;
}

/** One morph slot as the snapshot recorded it. Rank is that slot's own remembered rank. */
export interface GoalSubjectMorph {
  name: string;
  purchased: boolean;
  /** null when the game never reported a rank for this slot. 0 means reported unranked. */
  rank: number | null;
}

export interface GoalSubjectAbility {
  name: string;
  purchased: boolean;
  /**
   * Rank of this record's current form. null when the snapshot didn't carry one.
   * A morph's rank lives on `morphs`, not here — the headline rank is only the
   * form the name refers to.
   */
  rank: number | null;
  passive?: boolean;
  /** Scribing grimoire: unlocked or not. No morph rank. */
  crafted?: boolean;
  /** Passive upgrade cap from the snapshot. null when the game didn't report one. */
  maxRank?: number | null;
  /** Per-slot base + morphs. Empty on older snapshots that only stored the current name. */
  morphs?: GoalSubjectMorph[];
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
  /** First class this line name was seen on. Null for lines every class can train. */
  className: string | null;
  /**
   * Every class that owns a line of this name. Class Mastery is one name on
   * every class, so a single className is not enough to decide who it fits.
   */
  classNames?: string[];
}

/** Catalog ability metadata for class-validity guards, keyed by lowercase name. */
export interface AbilityMeta {
  lineName: string;
  category: string;
  className: string | null;
  /** True for a passive. Morphs are never passive. */
  passive?: boolean;
  /** Scribing grimoire unlocked by purchase, with no rank. */
  crafted?: boolean;
  /** Passive upgrade cap, when some snapshot reported it. */
  maxRank?: number | null;
}

export interface GoalIndexes {
  /** lowercase skill line name → catalog metadata. */
  lines?: Map<string, LineMeta>;
  /** lowercase ability/morph name → catalog metadata. */
  abilities?: Map<string, AbilityMeta>;
}

export type LineProgress =
  | { state: "done"; rank: number; targetRank?: number }
  | { state: "short"; rank: number; targetRank?: number; unpurchased?: boolean; rankUnknown?: boolean }
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
