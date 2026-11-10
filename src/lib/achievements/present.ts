import type { AchievementRecord } from "../snapshot/schema";
import {
  PITHKA_TABS,
  allTrackedIds,
  type PithkaTab,
  type PithkaType,
} from "./pithka";

/**
 * Presentation model for achievements.
 *
 * The snapshot still carries three historical shapes (legacy names, structured
 * records, flat completed-id sets). UI should consume this single view:
 * completion is membership in `completedIds`, and optional records supply
 * descriptions when the addon wrote them.
 */

export interface AchievementPresent {
  /** Authoritative completion set (account ∪ character-bound MSA clears). */
  completedIds: Set<number>;
  /** Structured records keyed by id when available. */
  recordsById: Map<number, AchievementRecord>;
  /** Legacy name list lowercased — only for search fallbacks. */
  earnedNames: Set<string>;
  /** How many Pithka-tracked cells are done vs trackable (unique ids). */
  pithka: {
    done: number;
    total: number;
    byTab: Record<PithkaTab, { done: number; total: number }>;
  };
  /** True when we have structured records from a modern snapshot. */
  hasRecords: boolean;
}

function emptyByTab(): Record<PithkaTab, { done: number; total: number }> {
  return {
    Trials: { done: 0, total: 0 },
    "Trifecta Dungeons": { done: 0, total: 0 },
    Arenas: { done: 0, total: 0 },
    "Base Dungeons": { done: 0, total: 0 },
  };
}

export function presentAchievements(input: {
  completedIds: number[];
  records?: AchievementRecord[];
  legacyNames?: string[];
}): AchievementPresent {
  const completedIds = new Set(input.completedIds);
  const recordsById = new Map<number, AchievementRecord>();
  for (const r of input.records ?? []) {
    if (r.id > 0) recordsById.set(r.id, r);
  }
  const earnedNames = new Set((input.legacyNames ?? []).map((n) => n.toLowerCase()));

  const byTab = emptyByTab();
  const seen = new Set<number>();
  let done = 0;
  let total = 0;
  for (const tab of PITHKA_TABS) {
    const ids = allTrackedIds(tab.rows);
    let tabDone = 0;
    for (const id of ids) {
      byTab[tab.id].total += 1;
      if (completedIds.has(id)) tabDone += 1;
      if (!seen.has(id)) {
        seen.add(id);
        total += 1;
        if (completedIds.has(id)) done += 1;
      }
    }
    byTab[tab.id].done = tabDone;
  }

  return {
    completedIds,
    recordsById,
    earnedNames,
    pithka: { done, total, byTab },
    hasRecords: recordsById.size > 0,
  };
}

export function isAchievementComplete(
  present: AchievementPresent,
  id: number | null | undefined,
): boolean {
  return typeof id === "number" && present.completedIds.has(id);
}

/** Tab labels for the board — re-export so Atlas pages don't dig into pithka internals. */
export const ACHIEVEMENT_TABS = PITHKA_TABS;

/** @deprecated Prefer tab tallies; kept for callers that still group by instance type. */
export type { PithkaType };
