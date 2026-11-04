import { MAX_ABILITY_RANK, morphSlotPurchased, romanRank } from "../skills/ability";
import type {
  AbilityMeta,
  Goal,
  GoalIndexes,
  GoalSubject,
  GoalSubjectAbility,
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

interface AbilityHit {
  purchased: boolean;
  /** null when this form's rank was never captured. */
  rank: number | null;
  passive: boolean;
  crafted: boolean;
  maxRank: number | null;
}

/**
 * The rank a goal is asking for. 0 means the live cap. Passives use the cap
 * the snapshot reported. Actives and morphs cap at IV. A grimoire has no rank.
 * Never invents a passive cap the game didn't report.
 */
export function abilityGoalRank(
  goalRank: number,
  passive?: boolean,
  crafted?: boolean,
  maxRank?: number | null,
): number | null {
  if (crafted) return null;
  const cap = passive ? (maxRank != null && maxRank > 0 ? maxRank : null) : MAX_ABILITY_RANK;
  if (!Number.isInteger(goalRank) || goalRank <= 0) return cap;
  if (cap == null) return goalRank;
  return Math.min(goalRank, cap);
}

function recordedRank(rank: number | null | undefined): number | null {
  if (typeof rank !== "number" || !Number.isFinite(rank)) return null;
  return rank;
}

function preferHit(current: AbilityHit, next: AbilityHit): AbilityHit {
  if (current.purchased !== next.purchased) return current.purchased ? current : next;
  return (current.rank ?? -1) >= (next.rank ?? -1) ? current : next;
}

/** Match one ability record. A morph is judged by that slot's rank, never a sibling's. */
function matchAbility(ability: GoalSubjectAbility, target: string): AbilityHit | null {
  const morphs = ability.morphs ?? [];
  const headline = normalizeLineName(ability.name).toLowerCase() === target;
  const morph = morphs.find((m) => normalizeLineName(m.name).toLowerCase() === target);
  if (morph) {
    // Slot rank wins. If an older snapshot only stored the current form's rank
    // on the headline, use that when this slot is the current form.
    const slotRank = recordedRank(morph.rank);
    return {
      purchased: morph.purchased,
      rank: slotRank ?? (headline ? recordedRank(ability.rank) : null),
      passive: false,
      crafted: false,
      maxRank: null,
    };
  }
  // Older snapshots stored morph names without per-slot ranks.
  const legacyName = ability.morphNames.some((m) => m.trim().toLowerCase() === target);
  if (legacyName) {
    return {
      purchased: ability.morphPurchased.some((m) => m.trim().toLowerCase() === target),
      rank: headline ? recordedRank(ability.rank) : null,
      passive: false,
      crafted: false,
      maxRank: null,
    };
  }
  if (!headline) return null;
  return {
    purchased: ability.purchased,
    rank: recordedRank(ability.rank),
    passive: ability.passive === true,
    crafted: ability.crafted === true,
    maxRank: ability.maxRank ?? null,
  };
}

function rankProgress(hit: AbilityHit, goalRank: number, meta?: AbilityMeta): LineProgress {
  const passive = hit.passive || meta?.passive === true;
  const crafted = hit.crafted || meta?.crafted === true;
  const maxRank = hit.maxRank ?? meta?.maxRank ?? null;
  const target = abilityGoalRank(goalRank, passive, crafted, maxRank);
  const rank = hit.rank != null && hit.rank > 0 ? hit.rank : 0;
  if (target == null) {
    if (hit.purchased) return { state: "done", rank };
    if (rank > 0) return { state: "short", rank, unpurchased: true };
    return { state: "short", rank: 0 };
  }
  if (hit.purchased && rank >= target) return { state: "done", rank, targetRank: target };
  if (hit.purchased && rank === 0) return { state: "short", rank: 0, targetRank: target, rankUnknown: true };
  if (!hit.purchased && rank > 0) return { state: "short", rank, targetRank: target, unpurchased: true };
  return { state: "short", rank, targetRank: target };
}

/**
 * Ability or morph progress from the snapshot. Done when that exact form is
 * purchased and its in-game rank reaches the target. A remembered rank on a
 * morph the character respecced out of stays visible and is not "done".
 * Another class's ability is not applicable. A line the character has, with
 * the ability never seen, is short — never invented as rank 0 complete.
 */
export function abilityProgress(
  subject: GoalSubject,
  abilityName: string,
  indexes?: GoalIndexes,
  goalRank = 0,
): LineProgress {
  if (!subject.lastSeen) return { state: "unknown" };
  const target = normalizeLineName(abilityName).toLowerCase();
  let hit: AbilityHit | null = null;
  for (const line of subject.skillLines) {
    for (const ability of line.abilities) {
      const found = matchAbility(ability, target);
      if (found) hit = hit ? preferHit(hit, found) : found;
    }
  }
  if (hit) return rankProgress(hit, goalRank, indexes?.abilities?.get(target));
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
      const targetRank = abilityGoalRank(goalRank, meta.passive, meta.crafted, meta.maxRank);
      return targetRank != null ? { state: "short", rank: 0, targetRank } : { state: "short", rank: 0 };
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
    case "skillline": {
      const need = goal.targetRank > 0 ? goal.targetRank : goal.extraRank;
      return skillLineProgress(subject, goal.target, need, indexes);
    }
    case "ability":
      return abilityProgress(subject, goal.target, indexes, goal.targetRank);
    case "script":
      return scriptProgress(subject, goal.target);
  }
}

/** Human label for any progress state, per goal domain. */
export function progressLabel(
  p: LineProgress,
  opts: { targetRank?: number; extraRank?: number; domain?: "skillline" | "ability" | "script" } = {},
): string {
  const kind = opts.domain ?? "skillline";
  if (p.state === "notapplicable") return p.reason ?? "Not applicable";
  if (p.state === "unknown") return "Not scanned yet";
  if (p.state === "undiscovered") return kind === "skillline" ? "Not discovered" : "Not learned yet";
  if (kind === "skillline") {
    const mandatory = opts.targetRank ?? 0;
    const extra = opts.extraRank ?? 0;
    if (mandatory > 0 && extra > mandatory) {
      if (p.rank >= extra) return `Rank ${p.rank} / ${extra}`;
      if (p.rank >= mandatory) return `Rank ${p.rank} · mandatory ${mandatory}, extra ${extra}`;
      return `Rank ${p.rank} / ${mandatory} · extra ${extra}`;
    }
    const target = mandatory > 0 ? mandatory : extra;
    return `Rank ${p.rank} / ${target}`;
  }
  if (kind === "ability" && (p.state === "done" || p.state === "short")) {
    const target = p.targetRank;
    if (p.state === "short" && p.rankUnknown) return "Rank unknown";
    if (p.state === "short" && p.unpurchased && p.rank > 0) {
      if (target != null && p.rank >= target) return `Rank ${romanRank(p.rank)} · not purchased`;
      if (target != null) return `Rank ${romanRank(p.rank)} / ${romanRank(target)} · not purchased`;
      return `Rank ${romanRank(p.rank)} · not purchased`;
    }
    if (p.rank > 0 && target != null) return `Rank ${romanRank(p.rank)} / ${romanRank(target)}`;
    if (p.rank > 0) return `Rank ${romanRank(p.rank)}`;
    if (p.state === "short" && target != null) return `Not learned · ${romanRank(target)}`;
    return p.state === "done" ? "Learned" : "Not learned yet";
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
        rank?: number | null;
        purchased?: boolean;
        passive?: boolean;
        crafted?: boolean;
        maxRank?: number | null;
        morphs?: { name?: string; purchased?: boolean; rank?: number | null }[];
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
      abilities: (l.abilities ?? []).map((a) => {
        const passive = a.passive === true;
        const crafted = a.crafted === true;
        const morphs = (a.morphs ?? []).flatMap((m) => {
          if (!m.name) return [];
          return [
            {
              name: m.name,
              purchased: morphSlotPurchased(m),
              rank: recordedRank(m.rank),
            },
          ];
        });
        const rank = recordedRank(a.rank);
        // Passives and grimoires trust the purchased flag. An active is owned
        // only when a slot (or, on older snapshots, the headline) is rank I+.
        const purchased =
          crafted || passive
            ? a.purchased === true
            : morphs.length > 0
              ? morphs.some((m) => m.purchased)
              : a.purchased === true && (rank ?? 0) >= 1;
        return {
          name: a.name,
          purchased,
          rank,
          passive,
          crafted,
          maxRank: passive ? (a.maxRank ?? null) : null,
          morphs,
          morphNames: morphs.map((m) => m.name),
          morphPurchased: morphs.filter((m) => m.purchased).map((m) => m.name),
        };
      }),
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
  fromCharacters: { name: string; category: string; maxRank?: number | null }[],
): SkillLineChoice[] {
  const byName = new Map<string, SkillLineChoice>();
  for (const c of [...catalog, ...fromCharacters]) {
    const name = normalizeLineName(c.name);
    if (!name) continue;
    const key = name.toLowerCase();
    const prev = byName.get(key);
    if (!prev) {
      byName.set(key, { name, category: c.category || "Skill", maxRank: c.maxRank ?? null });
    } else if (prev.maxRank == null && c.maxRank != null) {
      prev.maxRank = c.maxRank;
    }
  }
  return Array.from(byName.values()).sort(
    (a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}
