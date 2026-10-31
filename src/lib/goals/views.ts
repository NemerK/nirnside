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
