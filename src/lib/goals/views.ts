import type { Goal } from "./types";

/**
 * Compact, precomputed views of goal progress. Built on the server from the
 * last snapshot, so the browser never receives the account's full skill data —
 * only the small per-character marks it actually renders.
 */

export interface GoalMarkView {
  state: "done" | "short" | "undiscovered" | "unknown" | "notapplicable";
  label: string;
  reason?: string;
  /** Snapshot rank. Null when this character has not been scanned, or the rank was not recorded. */
  rank: number | null;
  /** End of the progress bar. Null when there is nothing to measure. */
  scale: number | null;
  /** Gold reaches this rank. 0 when the bar is extra-only. */
  mandatory: number;
  /** Blue ends at this rank when it is above mandatory. 0 when unset. */
  extra: number;
}

/** One character's row in a goal matrix. */
export interface GoalRowView {
  id: string;
  name: string;
  mark: GoalMarkView;
}

/** One goal card: the target plus its rollup and per-character rows. */
export interface GoalCardView {
  goal: Goal;
  done: number;
  total: number;
  unknown: number;
  notApplicable: number;
  rows: GoalRowView[];
  /** Encyclopedia link for skill-line targets, when the catalog has the line. */
  href?: string;
}

/** One goal as seen from a single character's page. */
export interface GoalRowItem {
  goal: Goal;
  mark: GoalMarkView;
  href?: string;
  deletable?: boolean;
}
