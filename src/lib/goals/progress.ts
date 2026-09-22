import type { Goal, GoalSubject, LineProgress, SkillLineChoice } from "./types";

export function normalizeLineName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function lineNamesMatch(a: string, b: string): boolean {
  return normalizeLineName(a).toLowerCase() === normalizeLineName(b).toLowerCase();
}

/**
 * Current rank vs a goal, using only the snapshot. Never invents a rank:
 * no logout → unknown; discovered line missing → undiscovered.
 */
export function skillLineProgress(
  subject: GoalSubject,
  lineName: string,
  targetRank: number,
): LineProgress {
  if (!subject.lastSeen) return { state: "unknown" };
  const line = subject.skillLines.find((l) => lineNamesMatch(l.name, lineName));
  if (!line) return { state: "undiscovered" };
  if (line.rank >= targetRank) return { state: "done", rank: line.rank };
  return { state: "short", rank: line.rank };
}

export function progressLabel(p: LineProgress, targetRank: number): string {
  if (p.state === "done") return `Rank ${p.rank} / ${targetRank}`;
  if (p.state === "short") return `Rank ${p.rank} / ${targetRank}`;
  if (p.state === "undiscovered") return "Not discovered";
  return "Not scanned yet";
}

export interface AccountGoalRow {
  character: GoalSubject;
  progress: LineProgress;
}

export interface AccountGoalSummary {
  done: number;
  total: number;
  unknown: number;
  rows: AccountGoalRow[];
}

/** Live roster only — archived toons are gone from the account. */
export function summarizeAccountGoal(goal: Goal, live: GoalSubject[]): AccountGoalSummary {
  const rows = live.map((character) => ({
    character,
    progress: skillLineProgress(character, goal.lineName, goal.targetRank),
  }));
  return {
    done: rows.filter((r) => r.progress.state === "done").length,
    total: rows.length,
    unknown: rows.filter((r) => r.progress.state === "unknown").length,
    rows,
  };
}

export function toGoalSubject(c: {
  id: string;
  name: string;
  lastSeen?: number | null;
  skillLines: { name: string; rank: number }[];
}): GoalSubject {
  return {
    id: c.id,
    name: c.name,
    lastSeen: c.lastSeen ?? null,
    skillLines: c.skillLines.map((l) => ({ name: l.name, rank: l.rank })),
  };
}

export function mergeSkillLineChoices(
  catalog: SkillLineChoice[],
  fromCharacters: { name: string; category: string }[],
): SkillLineChoice[] {
  const byName = new Map<string, SkillLineChoice>();
  for (const c of [...catalog, ...fromCharacters]) {
    const name = normalizeLineName(c.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (!byName.has(key)) byName.set(key, { name, category: c.category || "Skill" });
  }
  return Array.from(byName.values()).sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}
