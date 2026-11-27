import { TIERS, type Goal, type GoalDomain, type GoalTier } from "./types";
import type { ReviewGroup, ReviewTarget } from "./review";
import type { GoalMarkView } from "./views";

/**
 * The Planner grid: one row per thing being targeted (a skill line, an
 * ability, a script), one column per character. Each cell is that
 * character's result against whichever target governs them, so a line with
 * an account target and a per-character override is still one row.
 */

export interface MatrixCell {
  mark: GoalMarkView;
  goal: Goal;
  tier: GoalTier;
}

export interface MatrixRow {
  key: string;
  domain: GoalDomain;
  name: string;
  /** The most important tier any governing target gives this row. */
  tier: GoalTier;
  /** The targets behind the row, broadest first. */
  targets: ReviewTarget[];
  /** Character id → cell. A character no target governs has no cell. */
  cells: Map<string, MatrixCell>;
  open: number;
  done: number;
  /** Every governed character with a known result has met it. */
  complete: boolean;
}

const isOpen = (m: GoalMarkView) => m.state === "short" || m.state === "undiscovered";
const SCOPE_ORDER = { account: 0, class: 1, role: 2, character: 3 } as const;

export function subjectKey(goal: Pick<Goal, "domain" | "target">): string {
  return `${goal.domain}|${goal.target.trim().toLowerCase()}`;
}

export function buildMatrix(groups: ReviewGroup[]): MatrixRow[] {
  const rows = new Map<string, MatrixRow>();
  for (const t of groups.flatMap((g) => g.targets)) {
    const key = subjectKey(t.goal);
    let row = rows.get(key);
    if (!row) {
      row = {
        key,
        domain: t.goal.domain,
        name: t.goal.target,
        tier: t.goal.tier,
        targets: [],
        cells: new Map(),
        open: 0,
        done: 0,
        complete: false,
      };
      rows.set(key, row);
    }
    row.targets.push(t);
    for (const p of t.people) row.cells.set(p.id, { mark: p.mark, goal: t.goal, tier: t.goal.tier });
  }
  for (const row of rows.values()) {
    row.targets.sort((a, b) => SCOPE_ORDER[a.goal.scope] - SCOPE_ORDER[b.goal.scope]);
    // The row sits under the most important tier that still has work in it,
    // or the most important tier overall once everyone is done.
    const cells = [...row.cells.values()];
    const rank = (tier: GoalTier) => TIERS.indexOf(tier);
    const openTiers = cells.filter((c) => isOpen(c.mark)).map((c) => c.tier);
    const tiers = openTiers.length > 0 ? openTiers : row.targets.map((t) => t.goal.tier);
    row.tier = tiers.reduce((best, tier) => (rank(tier) < rank(best) ? tier : best), tiers[0] ?? row.tier);
    row.open = cells.filter((c) => isOpen(c.mark)).length;
    row.done = cells.filter((c) => c.mark.state === "done").length;
    row.complete = row.open === 0 && row.done > 0;
  }
  return [...rows.values()].sort(
    (a, b) =>
      TIERS.indexOf(a.tier) - TIERS.indexOf(b.tier) || b.open - a.open || a.name.localeCompare(b.name),
  );
}

const ROMAN = ["", "I", "II", "III", "IV"];

/** What a cell prints: "9/10", "II/IV", "—" for not discovered, "?" when not scanned. */
export function cellText(cell: MatrixCell): string {
  const { mark, goal } = cell;
  if (mark.state === "undiscovered") return "—";
  if (mark.state === "unknown") return "?";
  if (mark.state === "notapplicable") return "n/a";
  if (mark.rank == null) return mark.state === "done" ? "✓" : "…";
  const num = (n: number) => (goal.domain === "ability" ? (ROMAN[n] ?? String(n)) : String(n));
  if (mark.state === "done") return num(mark.rank);
  return mark.need != null ? `${num(mark.rank)}/${num(mark.need)}` : num(mark.rank);
}

/** How far along a short cell is, 0–1, for the little bar under it. */
export function cellProgress(cell: MatrixCell): number {
  const { mark } = cell;
  if (mark.state === "done") return 1;
  if (mark.rank == null || !mark.need) return 0;
  return Math.max(0, Math.min(1, mark.rank / mark.need));
}

export function isOpenMark(mark: GoalMarkView): boolean {
  return isOpen(mark);
}
