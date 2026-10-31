import type {
  Goal,
  GoalIndexes,
  GoalSubject,
  LineProgress,
  SkillLineChoice,
} from "./types";

export function normalizeLineName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function lineNamesMatch(a: string, b: string): boolean {
  return normalizeLineName(a).toLowerCase() === normalizeLineName(b).toLowerCase();
}

function lineCategoryIsClass(category: string | undefined | null): boolean {
  return !!category && category.trim().toLowerCase() === "class";
}

function isVampireLine(lineName: string): boolean {
  return lineName.trim().toLowerCase() === "vampire";
}

function isWerewolfLine(lineName: string): boolean {
  return lineName.trim().toLowerCase() === "werewolf";
}

/**
 * Does this goal even apply to this character? Scope decides who is checked —
 * a Tank-role target applies to every character wearing the Tank role, and the
 * progress step below decides whether the target can exist for that character
 * (a Necromancer line is never "missing" on a Dragonknight).
 */
export function goalAppliesTo(goal: Goal, subject: GoalSubject): boolean {
  switch (goal.scope) {
    case "account":
      return true;
    case "character":
      return goal.characterId === subject.id;
    case "role":
      return !!goal.scopeKey && subject.roleIds.includes(goal.scopeKey);
    case "class":
      return (
        !!goal.scopeKey && goal.scopeKey.trim().toLowerCase() === subject.className.trim().toLowerCase()
      );
  }
}

/**
 * Current skill-line rank vs a target, using only the snapshot. Never invents a
 * rank: no logout → unknown; a line the game can't give this character (another
 * class's line, or a curse line they don't have) → notapplicable, not missing.
 */
export function skillLineProgress(
  subject: GoalSubject,
  lineName: string,
  targetRank: number,
  indexes?: GoalIndexes,
): LineProgress {
  if (!subject.lastSeen) return { state: "unknown" };
  const line = subject.skillLines.find((l) => lineNamesMatch(l.name, lineName));
  if (line) {
    if (line.rank >= targetRank) return { state: "done", rank: line.rank };
    return { state: "short", rank: line.rank };
  }
  const meta = indexes?.lines?.get(normalizeLineName(lineName).toLowerCase());
  if (
    lineCategoryIsClass(meta?.category) &&
    meta?.className &&
    meta.className.trim().toLowerCase() !== subject.className.trim().toLowerCase()
  ) {
    return { state: "notapplicable", reason: `${meta.className} line` };
  }
  if (isVampireLine(lineName) && !subject.isVampire) {
    return { state: "notapplicable", reason: "Not a vampire" };
  }
  if (isWerewolfLine(lineName) && !subject.isWerewolf) {
    return { state: "notapplicable", reason: "Not a werewolf" };
  }
  return { state: "undiscovered" };
}

/**
 * Ability (or morph) ownership. A target is "done" when the base is purchased
 * or that exact morph is owned, "short" when the ability exists on this
 * character but is not purchased, "undiscovered" when the owning line exists
 * but the ability was never seen, and notapplicable when the ability belongs
 * to another class's line.
 */
export function abilityProgress(
  subject: GoalSubject,
  abilityName: string,
  indexes?: GoalIndexes,
): LineProgress {
  if (!subject.lastSeen) return { state: "unknown" };
  const target = normalizeLineName(abilityName).toLowerCase();
  let seen = false;
  let known = false;
  for (const line of subject.skillLines) {
    for (const ability of line.abilities) {
      const baseHit = normalizeLineName(ability.name).toLowerCase() === target;
      // Owning the base is not owning the morph — each is checked by its own name.
      const morphSeen = ability.morphNames.some((m) => m.trim().toLowerCase() === target);
      const morphOwned = ability.morphPurchased.some((m) => m.trim().toLowerCase() === target);
      if (baseHit || morphSeen || morphOwned) {
        seen = true;
        if ((baseHit && ability.purchased) || morphOwned) known = true;
      }
    }
  }
  if (known) return { state: "done", rank: 0 };
  if (seen) return { state: "short", rank: 0 };
  // No ability data at all (roster row) — unknown, never "missing".
  if (!subject.full) return { state: "unknown" };
  const meta = indexes?.abilities?.get(target);
  if (meta) {
    if (
      lineCategoryIsClass(meta.category) &&
      meta.className &&
      meta.className.trim().toLowerCase() !== subject.className.trim().toLowerCase()
    ) {
      return { state: "notapplicable", reason: `${meta.className} ability` };
    }
    if (subject.skillLines.some((l) => lineNamesMatch(l.name, meta.lineName))) {
      return { state: "short", rank: 0 };
    }
    if (isVampireLine(meta.lineName) && !subject.isVampire) {
      return { state: "notapplicable", reason: "Not a vampire" };
    }
    if (isWerewolfLine(meta.lineName) && !subject.isWerewolf) {
      return { state: "notapplicable", reason: "Not a werewolf" };
    }
    return { state: "undiscovered" };
  }
  return { state: "undiscovered" };
}

/** Script knowledge for this character, from the last snapshot. */
export function scriptProgress(subject: GoalSubject, scriptName: string): LineProgress {
  if (!subject.lastSeen) return { state: "unknown" };
  if (!subject.full) return { state: "unknown" };
  const target = normalizeLineName(scriptName).toLowerCase();
  const known = subject.scribingScripts.some((s) => s.trim().toLowerCase() === target);
  return known ? { state: "done", rank: 0 } : { state: "short", rank: 0 };
}

/** Progress of any goal for one character, dispatched by domain. */
export function goalProgress(goal: Goal, subject: GoalSubject, indexes?: GoalIndexes): LineProgress {
  switch (goal.domain) {
    case "skillline":
      return skillLineProgress(subject, goal.target, goal.targetRank, indexes);
    case "ability":
      return abilityProgress(subject, goal.target, indexes);
    case "script":
      return scriptProgress(subject, goal.target);
  }
}

/** Human label for any progress state, per goal domain. */
export function progressLabel(
  p: LineProgress,
  opts: { targetRank?: number; domain?: "skillline" | "ability" | "script" } = {},
): string {
  const kind = opts.domain ?? "skillline";
  if (p.state === "notapplicable") return p.reason ?? "Not applicable";
  if (p.state === "unknown") return "Not scanned yet";
  if (p.state === "undiscovered") return kind === "skillline" ? "Not discovered" : "Not learned yet";
  if (kind === "skillline") {
    const target = opts.targetRank ?? 0;
    return `Rank ${p.rank} / ${target}`;
  }
  return p.state === "done" ? "Learned" : "Not learned yet";
}

export interface GoalRow {
  character: GoalSubject;
  progress: LineProgress;
}

export interface GoalSummary {
  done: number;
  /** Applicable characters only — notapplicable rows never count as work. */
  total: number;
  unknown: number;
  notApplicable: number;
  rows: GoalRow[];
}

/** Per-character progress for one goal, across whoever it applies to. */
export function summarizeGoal(goal: Goal, subjects: GoalSubject[], indexes?: GoalIndexes): GoalSummary {
  const rows: GoalRow[] = [];
  for (const character of subjects) {
    if (!goalAppliesTo(goal, character)) continue;
    rows.push({ character, progress: goalProgress(goal, character, indexes) });
  }
  const applicable = rows.filter((r) => r.progress.state !== "notapplicable");
  return {
    done: applicable.filter((r) => r.progress.state === "done").length,
    total: applicable.length,
    unknown: applicable.filter((r) => r.progress.state === "unknown").length,
    notApplicable: rows.length - applicable.length,
    rows,
  };
}

export function toGoalSubject(
  c: {
    id: string;
    name: string;
    class: string;
    lastSeen?: number | null;
    skillLines: {
      name: string;
      rank: number;
      abilities?: {
        name: string;
        purchased?: boolean;
        morphs?: { name?: string; purchased?: boolean }[];
      }[];
    }[];
    scribingScripts?: string[];
    vampire?: { isVampire?: boolean };
    werewolf?: { isWerewolf?: boolean };
  },
  roleIds: string[] = [],
  full = false,
): GoalSubject {
  return {
    id: c.id,
    name: c.name,
    className: c.class,
    lastSeen: c.lastSeen ?? null,
    skillLines: (c.skillLines ?? []).map((l) => ({
      name: l.name,
      rank: l.rank,
      abilities: (l.abilities ?? []).map((a) => ({
        name: a.name,
        purchased: a.purchased ?? false,
        morphNames: (a.morphs ?? []).map((m) => m.name).filter((m): m is string => !!m),
        morphPurchased: (a.morphs ?? [])
          .filter((m) => m.purchased && m.name)
          .map((m) => m.name as string),
      })),
    })),
    scribingScripts: c.scribingScripts ?? [],
    isVampire: c.vampire?.isVampire ?? false,
    isWerewolf: c.werewolf?.isWerewolf ?? false,
    roleIds,
    full,
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
