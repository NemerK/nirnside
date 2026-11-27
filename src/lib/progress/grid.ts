import { CLASSES } from "../game/classes";
import { lineNamesMatch, normalizeLineName, skillLineProgress } from "../goals/progress";
import { effectiveGoal } from "../goals/effective";
import type { Goal, GoalIndexes, GoalScope, GoalSubject, LineMeta } from "../goals/types";

/**
 * The Progress grid: every skill line down the side, every live character
 * across the top. A cell is one character's rank on one line, judged by the
 * same rules the Targets page uses (`skillLineProgress`), with the target
 * that applies to that character drawn on top.
 *
 * Built on the server; the browser receives only these compact rows.
 */

export interface GridColumn {
  id: string;
  name: string;
  className: string;
  /** False until this character has logged out with the addon. */
  scanned: boolean;
  roleIds: string[];
}

/**
 * done — at the line's cap, or at/over the target when one applies
 * short — known rank below that
 * undiscovered — the character has not found the line yet
 * na — another class's line, or vampire/werewolf on someone who isn't
 * unknown — this character has never been snapshotted
 */
export type CellState = "done" | "short" | "undiscovered" | "na" | "unknown";

export interface CellTarget {
  goalId: string;
  scope: GoalScope;
  /** Mandatory rank, 0 when only an extra rank is set. */
  rank: number;
  /** Extra rank above mandatory, 0 when unset. */
  extra: number;
}

export interface LineCell {
  state: CellState;
  rank: number | null;
  target: CellTarget | null;
  /** Why the cell is not applicable, for its tooltip. */
  reason?: string;
  /** Another class's line this character trains through subclassing. Shown, never targeted. */
  subclassed?: boolean;
}

export interface LineRow {
  name: string;
  category: string;
  className: string | null;
  /** Live rank cap. Null when the line has no fixed cap we trust. */
  cap: number | null;
  icon: string | null;
  cells: LineCell[];
  /** Some character has a target on this line. */
  targeted: boolean;
  /** Every character the line applies to is done. */
  complete: boolean;
}

export interface LineGroup {
  key: string;
  title: string;
  className: string | null;
  rows: LineRow[];
}

export interface LineGrid {
  columns: GridColumn[];
  groups: LineGroup[];
}

export interface GridLineSource {
  name: string;
  category: string;
  className: string | null;
  maxRank: number | null;
  icon: string | null;
}

const CATEGORY_ORDER = ["class", "weapon", "armor", "world", "guild", "alliance war", "craft", "racial"];

function titleCase(raw: string): string {
  const key = raw.trim().toLowerCase();
  if (key === "alliance war") return "Alliance War";
  if (!key) return "Other";
  return raw.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

function isClassCategory(category: string): boolean {
  const key = category.trim().toLowerCase();
  return key === "class" || key === "class mastery";
}

/** The skill-line target that governs one character (see goals/effective). */
export function effectiveLineTarget(goals: Goal[], subject: GoalSubject, lineName: string): CellTarget | null {
  const goal = effectiveGoal(goals, subject, "skillline", lineName);
  if (!goal) return null;
  return { goalId: goal.id, scope: goal.scope, rank: goal.targetRank, extra: goal.extraRank };
}

function cellFor(subject: GoalSubject, line: GridLineSource, goals: Goal[], indexes: GoalIndexes): LineCell {
  const target = effectiveLineTarget(goals, subject, line.name);
  // Done means the target when there is one, otherwise the line's own cap.
  const goalRank = target ? target.rank || target.extra : null;
  const finish = goalRank ?? line.maxRank ?? Number.POSITIVE_INFINITY;
  const progress = skillLineProgress(subject, line.name, finish, indexes);
  switch (progress.state) {
    case "done":
      return { state: "done", rank: progress.rank, target };
    case "short":
      return { state: "short", rank: progress.rank, target };
    case "undiscovered":
      return { state: "undiscovered", rank: null, target };
    case "unknown":
      return { state: "unknown", rank: null, target };
    case "notapplicable": {
      // Targets never reach across classes, but a subclassed line's real rank is still worth seeing.
      const owned = subject.skillLines.find((l) => lineNamesMatch(l.name, line.name));
      if (owned && subject.lastSeen != null) {
        const done = line.maxRank != null && owned.rank >= line.maxRank;
        return { state: done ? "done" : "short", rank: owned.rank, target: null, subclassed: true };
      }
      return { state: "na", rank: null, target: null, reason: progress.reason };
    }
  }
}

/** Class lines only show for classes someone on the roster plays or has subclassed. */
function classesInPlay(subjects: GoalSubject[], lines: GridLineSource[]): Set<string> {
  const out = new Set(subjects.map((s) => s.className.toLowerCase()));
  for (const s of subjects) {
    for (const owned of s.skillLines) {
      const line = lines.find((l) => isClassCategory(l.category) && l.className && lineNamesMatch(l.name, owned.name));
      if (line?.className) out.add(line.className.toLowerCase());
    }
  }
  return out;
}

export function buildLineGrid(input: {
  subjects: GoalSubject[];
  lines: GridLineSource[];
  lineIndex: [string, LineMeta][];
  goals: Goal[];
}): LineGrid {
  const indexes: GoalIndexes = { lines: new Map(input.lineIndex) };
  const columns: GridColumn[] = input.subjects.map((s) => ({
    id: s.id,
    name: s.name,
    className: s.className,
    scanned: s.lastSeen != null,
    roleIds: s.roleIds,
  }));
  const inPlay = classesInPlay(input.subjects, input.lines);
  const groups = new Map<string, LineGroup>();
  const seen = new Set<string>();

  for (const line of input.lines) {
    const classLine = isClassCategory(line.category);
    // Class Mastery is points, not a rank line; it has its own place on the character page.
    if (normalizeLineName(line.name).toLowerCase() === "class mastery") continue;
    if (classLine && line.className && !inPlay.has(line.className.toLowerCase())) continue;
    const dedupe = `${classLine ? (line.className ?? "").toLowerCase() : ""}|${line.name.toLowerCase()}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const cells = input.subjects.map((s) => cellFor(s, line, input.goals, indexes));
    const applicable = cells.filter((c) => c.state !== "na" && !c.subclassed);
    const row: LineRow = {
      name: line.name,
      category: classLine ? "Class" : titleCase(line.category),
      className: classLine ? line.className : null,
      cap: line.maxRank,
      icon: line.icon,
      cells,
      targeted: cells.some((c) => c.target != null),
      complete: applicable.length > 0 && applicable.every((c) => c.state === "done"),
    };
    const key = row.className ? `class:${row.className.toLowerCase()}` : `cat:${row.category.toLowerCase()}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, title: row.className ?? row.category, className: row.className, rows: [] };
      groups.set(key, group);
    }
    group.rows.push(row);
  }

  const rank = (g: LineGroup) => {
    if (g.className) {
      const i = CLASSES.findIndex((c) => c.toLowerCase() === g.className!.toLowerCase());
      return i < 0 ? 9 : i / 10;
    }
    const i = CATEGORY_ORDER.indexOf(g.title.toLowerCase());
    return i < 0 ? 90 : i;
  };
  const ordered = [...groups.values()].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));
  return { columns, groups: ordered };
}

/** 0..1 share of the way to the cell's finish line, for the cell's fill. */
export function cellFill(cell: LineCell, cap: number | null): number {
  if (cell.state === "done") return 1;
  if (cell.state !== "short" || cell.rank == null) return 0;
  const goal = cell.target ? cell.target.rank || cell.target.extra : null;
  const finish = goal ?? cap;
  if (!finish) return 0;
  return Math.max(0, Math.min(1, cell.rank / finish));
}
