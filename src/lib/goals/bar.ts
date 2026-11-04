import type { Goal, LineProgress } from "./types";

/** Numbers a target bar needs. Rank is null when the snapshot has not been seen. */
export interface GoalBarMeasures {
  rank: number | null;
  /** End of the track. Null when this target has no rank to draw. */
  scale: number | null;
  /** Gold stops at this rank. 0 means the fill is the extra color only. */
  mandatory: number;
  /** Blue ends at this rank when it sits above mandatory. 0 when unset. */
  extra: number;
}

export interface GoalBarSegments {
  /** Share of the track filled gold, from 0 to 1. */
  gold: number;
  /** Share of the track filled blue, from 0 to 1. It starts at the mandatory split. */
  blue: number;
  /** Mandatory boundary as a share of the track, from 0 to 1. */
  split: number;
}

function abilityScale(progress: LineProgress, goalRank: number): number {
  if (progress.state === "done" || progress.state === "short") {
    if (progress.targetRank != null && progress.targetRank > 0) return progress.targetRank;
  }
  if (goalRank > 0) return goalRank;
  return 1;
}

/** Rank, track length, and the gold/blue split for one character's mark. */
export function goalMarkMeasures(
  progress: LineProgress,
  goal: Pick<Goal, "domain" | "targetRank" | "extraRank">,
): GoalBarMeasures {
  if (progress.state === "notapplicable") return { rank: null, scale: null, mandatory: 0, extra: 0 };
  if (goal.domain === "script") {
    return {
      rank: progress.state === "unknown" ? null : progress.state === "done" ? 1 : 0,
      scale: 1,
      mandatory: 1,
      extra: 0,
    };
  }
  if (goal.domain === "ability") {
    const scale = abilityScale(progress, goal.targetRank);
    const rank =
      progress.state === "unknown" || (progress.state === "short" && progress.rankUnknown)
        ? null
        : progress.state === "undiscovered"
          ? 0
          : progress.rank;
    return { rank, scale, mandatory: scale, extra: 0 };
  }
  const mandatory = goal.targetRank > 0 ? goal.targetRank : 0;
  const extra = goal.extraRank > mandatory ? goal.extraRank : 0;
  const scale = extra > 0 ? extra : mandatory > 0 ? mandatory : 0;
  const rank = progress.state === "unknown" ? null : progress.state === "undiscovered" ? 0 : progress.rank;
  return { rank, scale: scale > 0 ? scale : null, mandatory, extra };
}

/**
 * How much of the track to paint. Unknown and not-applicable marks paint nothing:
 * an empty track is not a rank of 0.
 */
export function goalBarSegments(
  input: GoalBarMeasures & { state: LineProgress["state"] },
): GoalBarSegments | null {
  if (input.state === "unknown" || input.state === "notapplicable") return null;
  if (input.scale == null || input.scale <= 0 || input.rank == null) return null;
  const scale = input.scale;
  const current = Math.min(Math.max(input.rank, 0), scale);
  const splitRank = input.mandatory > 0 ? Math.min(input.mandatory, scale) : 0;
  const goldRank = Math.min(current, splitRank);
  return {
    gold: goldRank / scale,
    blue: (current - goldRank) / scale,
    split: splitRank / scale,
  };
}
