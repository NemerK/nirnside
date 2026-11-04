import "server-only";
import { cache } from "react";
import { getCharacters, getCharactersFull } from "../db/queries";
import { liveCharacters } from "../snapshot/roster";
import { listRoles, listAssignments } from "../db/roles";
import { getSkillLines, getScripts, getSkills } from "../db/catalog-queries";
import { isExcludedSkillLine } from "../catalog/excluded";
import {
  goalAppliesTo,
  goalProgress,
  mergeSkillLineChoices,
  progressLabel,
  summarizeGoal,
  toGoalSubject,
} from "../goals/progress";
import type { Goal, GoalIndexes } from "../goals/types";
import type { GoalCardView, GoalMarkView, GoalRowItem } from "../goals/views";
import { ESO_CLASSES } from "../classes";
import { plannerAbilityIcon, plannerLineIcon, plannerScriptIcon } from "../icons/planner-icons";
import { plannerLineKey } from "./skill-groups";
import { skillLineCap } from "../skills/line-cap";
import type { AbilityMeta, GoalSubject, LineMeta, SkillLineChoice } from "../goals/types";

/**
 * Everything the planner (and the Home targets board) needs, assembled once:
 * full-character goal subjects, catalog + snapshot line/ability metadata for
 * class-validity guards, and the composer's pick lists. Catalog and snapshots
 * are merged name-by-name so a partial in-game scan upgrades a target's guard
 * data without dropping anything.
 */

export interface PlannerLineChoice {
  name: string;
  category: string;
  className: string | null;
  /** Live rank cap for this line, when known (most are 50; guild/PvP/curse lines cap lower). */
  maxRank: number | null;
  /** ESO texture path, or null when no confirmed art exists for this line. */
  icon: string | null;
}

export interface PlannerAbilityChoice {
  name: string;
  lineName: string;
  className: string | null;
  icon: string | null;
}

export interface GoalIndexArrays {
  lineIndex: [string, LineMeta][];
  abilityIndex: [string, AbilityMeta][];
}

export interface PlannerData extends GoalIndexArrays {
  subjects: GoalSubject[];
  roles: { id: string; name: string }[];
  classes: string[];
  lines: PlannerLineChoice[];
  scripts: { name: string; slot: string; icon: string | null }[];
  abilities: PlannerAbilityChoice[];
}

function isClassCategory(category: string): boolean {
  return category.trim().toLowerCase() === "class";
}

function collectLineAbilityData(live: ReturnType<typeof getCharactersFull>) {
  const catalogLines = safe(getSkillLines) ?? [];
  const lineMeta = new Map<string, LineMeta>();
  const lines: PlannerLineChoice[] = [];
  const catalogLineIcons = new Map<string, string>();
  for (const { entry } of catalogLines) {
    if (isExcludedSkillLine(entry)) continue;
    const key = entry.name.trim().toLowerCase();
    if (!key) continue;
    const meta: LineMeta = { category: entry.category, className: entry.className ?? null };
    if (!lineMeta.has(key)) lineMeta.set(key, meta);
    const choice: PlannerLineChoice = {
      name: entry.name,
      category: entry.category,
      className: entry.className ?? null,
      maxRank: entry.maxRank ?? skillLineCap(entry.name),
      icon: null,
    };
    lines.push(choice);
    const scanned = entry.icon?.trim();
    if (scanned) catalogLineIcons.set(plannerLineKey(choice), scanned);
  }
  for (const c of live) {
    for (const line of c.skillLines) {
      if (isExcludedSkillLine(line)) continue;
      const key = line.name.trim().toLowerCase();
      if (!key || lineMeta.has(key)) continue;
      const meta: LineMeta = {
        category: line.category || "Skill",
        className: isClassCategory(line.category) ? c.class : null,
      };
      lineMeta.set(key, meta);
      lines.push({
        name: line.name,
        category: meta.category,
        className: meta.className,
        maxRank: skillLineCap(line.name),
        icon: null,
      });
    }
  }

  const abilityMeta = new Map<string, AbilityMeta>();
  const abilities: PlannerAbilityChoice[] = [];
  const lineNameById = new Map(
    catalogLines.filter(({ entry }) => !isExcludedSkillLine(entry)).map(({ entry }) => [entry.id, entry]),
  );
  function rememberAbility(name: string, meta: AbilityMeta, icon: string | null) {
    const key = name.trim().toLowerCase();
    if (!key) return;
    const prev = abilityMeta.get(key);
    if (!prev) {
      abilityMeta.set(key, meta);
      abilities.push({ name, lineName: meta.lineName, className: meta.className, icon });
      return;
    }
    // A later snapshot can fill a passive cap the catalog doesn't carry.
    if (prev.maxRank == null && meta.maxRank != null) prev.maxRank = meta.maxRank;
    if (!prev.passive && meta.passive) prev.passive = true;
    if (!prev.crafted && meta.crafted) prev.crafted = true;
    if (icon) {
      const row = abilities.find((ability) => ability.name.trim().toLowerCase() === key);
      if (row && !row.icon) row.icon = icon;
    }
  }
  for (const { entry } of safe(getSkills) ?? []) {
    const line = lineNameById.get(entry.lineId);
    if (!line || isExcludedSkillLine(line)) continue;
    const shared = {
      lineName: line.name,
      category: line.category,
      className: line.className ?? null,
    };
    const morphNames = entry.morphs.map((m) => m.name);
    rememberAbility(
      entry.name,
      { ...shared, passive: entry.type === "passive", crafted: false, maxRank: null },
      plannerAbilityIcon({
        name: entry.name,
        morphNames,
        catalogIcon: entry.icon,
        lineName: line.name,
        className: line.className,
      }),
    );
    for (const m of entry.morphs) {
      rememberAbility(
        m.name,
        { ...shared, passive: false, crafted: false, maxRank: null },
        plannerAbilityIcon({
          name: m.name,
          catalogIcon: m.icon ?? entry.icon,
          lineName: line.name,
          className: line.className,
        }),
      );
    }
  }
  for (const c of live) {
    for (const line of c.skillLines) {
      if (isExcludedSkillLine(line)) continue;
      const shared = {
        lineName: line.name,
        category: line.category || "Skill",
        className: isClassCategory(line.category) ? c.class : null,
      };
      for (const ability of line.abilities) {
        const slots = ability.morphs ?? [];
        const slotNames = new Set(
          slots.map((m) => m.name?.trim().toLowerCase()).filter((n): n is string => !!n),
        );
        // A morphed ability's headline name is the current morph, not a passive.
        const headlineIsSlot = slotNames.has(ability.name.trim().toLowerCase());
        const passive = ability.passive === true && !headlineIsSlot;
        const slotNamesList = slots.map((m) => m.name);
        rememberAbility(
          ability.name,
          {
            ...shared,
            passive,
            crafted: ability.crafted === true,
            maxRank: passive ? (ability.maxRank ?? null) : null,
          },
          plannerAbilityIcon({
            name: ability.name,
            morphNames: slotNamesList,
            lineName: line.name,
            className: shared.className,
          }),
        );
        for (const m of slots) {
          if (!m.name) continue;
          rememberAbility(
            m.name,
            { ...shared, passive: false, crafted: false, maxRank: null },
            plannerAbilityIcon({
              name: m.name,
              lineName: line.name,
              className: shared.className,
            }),
          );
        }
      }
    }
  }

  const abilityFace = new Map<string, string>();
  for (const ability of abilities) {
    if (!ability.icon) continue;
    const key = plannerLineKey({ name: ability.lineName, className: ability.className });
    if (!abilityFace.has(key)) abilityFace.set(key, ability.icon);
  }
  for (const line of lines) {
    const key = plannerLineKey(line);
    line.icon = plannerLineIcon({
      name: line.name,
      className: line.className,
      catalogIcon: catalogLineIcons.get(key) ?? null,
      abilityIcon: abilityFace.get(key) ?? null,
    });
  }

  return {
    lines: lines.sort(
      (a, b) =>
        Number(isClassCategory(a.category) ? 1 : 0) - Number(isClassCategory(b.category) ? 1 : 0) ||
        (a.category ?? "").localeCompare(b.category ?? "") ||
        a.name.localeCompare(b.name),
    ),
    abilities,
    lineIndex: [...lineMeta.entries()] as [string, LineMeta][],
    abilityIndex: [...abilityMeta.entries()] as [string, AbilityMeta][],
  };
}

function liveFull() {
  return liveCharacters(safe(getCharactersFull) ?? []);
}

/** Line + ability metadata only, for pages that show per-character progress. */
export const buildGoalIndexes = cache(function buildGoalIndexes(): GoalIndexArrays {
  const { lineIndex, abilityIndex } = collectLineAbilityData(liveFull());
  return { lineIndex, abilityIndex };
});

function toMark(
  progress: ReturnType<typeof goalProgress>,
  goal: Goal,
): GoalMarkView {
  return {
    state: progress.state,
    label: progressLabel(progress, {
      targetRank: goal.targetRank,
      extraRank: goal.extraRank,
      domain: goal.domain,
    }),
    reason: progress.state === "notapplicable" ? progress.reason : undefined,
  };
}

/**
 * Precompute every goal's matrix on the server. The client receives compact
 * rows only — never the account's full skill/ability data.
 */
export function goalCardsForClient(
  goals: Goal[],
  data: PlannerData,
  hrefFor?: (goal: Goal) => string | undefined,
): GoalCardView[] {
  const indexes: GoalIndexes = {
    lines: new Map(data.lineIndex),
    abilities: new Map(data.abilityIndex),
  };
  return goals.map((goal) => {
    const summary = summarizeGoal(goal, data.subjects, indexes);
    return {
      goal,
      done: summary.done,
      total: summary.total,
      unknown: summary.unknown,
      notApplicable: summary.notApplicable,
      rows: summary.rows.map((r) => ({
        id: r.character.id,
        name: r.character.name,
        mark: toMark(goalProgress(goal, r.character, indexes), goal),
      })),
      href: hrefFor?.(goal),
    };
  });
}

/** The goals that apply to one character, precomputed with their marks. */
export function characterGoalRows(
  goals: Goal[],
  subject: GoalSubject,
  indexes: GoalIndexArrays,
  hrefFor?: (goal: Goal) => string | undefined,
): GoalRowItem[] {
  const built: GoalIndexes = {
    lines: new Map(indexes.lineIndex),
    abilities: new Map(indexes.abilityIndex),
  };
  return goals
    .filter((g) => goalAppliesTo(g, subject))
    .map((goal) => ({
      goal,
      mark: toMark(goalProgress(goal, subject, built), goal),
      deletable: goal.scope === "character",
      href: hrefFor?.(goal),
    }));
}

/** Catalog lines plus any names already on the account (in-game snapshot wins for extras). */
export const skillLineChoices = cache(function skillLineChoices(): SkillLineChoice[] {
  let catalog: SkillLineChoice[] = [];
  try {
    catalog = getSkillLines()
      .filter(({ entry }) => !isExcludedSkillLine(entry))
      .map(({ entry }) => ({
        name: entry.name,
        category: entry.category,
        maxRank: entry.maxRank ?? skillLineCap(entry.name),
      }));
  } catch {
    catalog = [];
  }
  const fromChars: SkillLineChoice[] = [];
  try {
    for (const c of getCharacters()) {
      for (const l of c.skillLines) {
        if (isExcludedSkillLine(l)) continue;
        fromChars.push({ name: l.name, category: l.category, maxRank: skillLineCap(l.name) });
      }
    }
  } catch {
    // no roster yet
  }
  return mergeSkillLineChoices(catalog, fromChars);
});

export const loadPlannerData = cache(function loadPlannerData(): PlannerData {
  const live = liveFull();
  const assignments = safe(listAssignments) ?? {};
  const roleRows = safe(listRoles) ?? [];

  const subjects = live.map((c) =>
    toGoalSubject(
      c,
      (assignments[c.id] ?? []).filter((id) => typeof id === "string"),
      true,
    ),
  );

  const { lines, abilities, lineIndex, abilityIndex } = collectLineAbilityData(live);
  const scripts = (safe(getScripts) ?? []).map(({ entry }) => ({
    name: entry.name,
    slot: entry.slot,
    icon: plannerScriptIcon(entry.name),
  }));

  return {
    subjects,
    roles: roleRows.map((r) => ({ id: r.id, name: r.name })),
    classes: [...ESO_CLASSES],
    lines,
    scripts,
    abilities,
    lineIndex,
    abilityIndex,
  };
});

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
