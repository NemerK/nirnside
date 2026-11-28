import "server-only";
import { skillCategory } from "@/lib/game/skills";
import { getDb } from "../db";
import { getCharacters } from "../db/queries";
import { getScripts, getSkillLines, getSkills } from "../db/catalog-queries";
import { listAssignments } from "../db/roles";
import { toGoalSubject } from "../goals/progress";
import type { GoalSubject, LineMeta } from "../goals/types";
import type { GridLineSource } from "../progress/grid";
import { skillLineCap } from "../game/skill-caps";
import { isExcludedSkillLine } from "../game/vengeance";
import { applyRosterOrder, getRosterOrder } from "../roster/order";
import type { Character, CharacterDailies } from "../snapshot/schema";

/**
 * Light loaders for Party pages. Each reads only the columns or JSON fields a
 * page shows — never every character's whole snapshot — so a 20-character
 * account stays as quick as a 3-character one.
 */

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Live roster in the player's order, with line ranks but no abilities. */
export function roster(): Character[] {
  return applyRosterOrder(safe(() => getCharacters(), []), safe(() => getRosterOrder(), []));
}

/** Goal subjects from the light roster. Ability and script targets read as unknown on these. */
export function lightSubjects(): GoalSubject[] {
  const assignments = safe(() => listAssignments(), {} as Record<string, string[]>);
  return roster().map((c) => toGoalSubject(c, assignments[c.id] ?? [], false));
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Every skill line to compare: the catalog's lines plus any line a character
 * has that the catalog doesn't list yet. Class lines keep their owning class.
 */
export function compareLines(characters: Character[] = roster()): {
  lines: GridLineSource[];
  lineIndex: [string, LineMeta][];
} {
  const lines: GridLineSource[] = [];
  const index = new Map<string, LineMeta>();
  const remember = (name: string, category: string, className: string | null) => {
    const key = name.trim().toLowerCase();
    const prev = index.get(key);
    const owners = new Set(prev?.classNames ?? (prev?.className ? [prev.className] : []));
    if (className) owners.add(className);
    index.set(key, {
      category: prev?.category ?? category,
      className: prev?.className ?? className,
      classNames: owners.size > 0 ? [...owners] : undefined,
    });
  };
  for (const { entry } of safe(() => getSkillLines(), [])) {
    const isClass = entry.category.trim().toLowerCase() === "class";
    lines.push({
      name: entry.name,
      category: entry.category,
      className: isClass ? entry.className : null,
      maxRank: entry.maxRank ?? skillLineCap(entry.name),
      icon: entry.icon,
    });
    remember(entry.name, entry.category, isClass ? entry.className : null);
  }
  for (const c of characters) {
    for (const l of c.skillLines) {
      if (isExcludedSkillLine(l)) continue;
      if (lines.some((x) => sameName(x.name, l.name))) continue;
      const isClass = l.category.trim().toLowerCase() === "class";
      // The class the game named for the line (addon 0.9.44+); before that, a
      // character's own class line tells us its owner, a subclassed one doesn't.
      const owner = isClass ? (l.className?.trim() || (!l.subclassed ? c.class : null)) : null;
      lines.push({ name: l.name, category: l.category, className: owner, maxRank: skillLineCap(l.name), icon: null });
      remember(l.name, l.category, owner);
    }
  }
  return { lines, lineIndex: [...index.entries()] };
}

export interface ChoiceSource {
  domain: "skillline" | "ability" | "script";
  name: string;
  cap: number | null;
  className: string | null;
  context: string;
  /** The skills window category it sits under: Class, Weapon, Armor, World… */
  category?: string;
  /** For abilities: the skill line it belongs to. */
  line?: string;
}

const choiceCategory = skillCategory;

const SLOT_WORD: Record<string, string> = { focus: "Focus script", signature: "Signature script", affix: "Affix script" };

/** What a new target can point at, from the catalog (no character snapshots needed). */
export function targetChoices(lines: GridLineSource[]): ChoiceSource[] {
  const out: ChoiceSource[] = [];
  const seen = new Set<string>();
  const add = (s: ChoiceSource) => {
    const key = `${s.domain}|${s.className ?? ""}|${s.name.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };
  // Each line arrives once, with its class: the catalog files every line
  // under one id (game/skills.ts skillLineId) and heals older copies on load.
  const lineById = new Map<string, GridLineSource>();
  for (const { entry } of safe(() => getSkillLines(), [])) {
    const l = lines.find((x) => sameName(x.name, entry.name));
    if (l) lineById.set(entry.id, l);
  }
  for (const l of lines) {
    if (sameName(l.name, "class mastery")) continue;
    add({
      domain: "skillline",
      name: l.name,
      cap: l.maxRank,
      className: l.className,
      context: l.className ?? l.category,
      category: choiceCategory(l.category, l.className),
    });
  }
  for (const { entry } of safe(() => getSkills(), [])) {
    const line = lineById.get(entry.lineId);
    const className = line?.className ?? null;
    const category = line ? choiceCategory(line.category, className) : "Other";
    const lineName = line?.name ?? "Other";
    add({ domain: "ability", name: entry.name, cap: null, className, context: lineName, category, line: lineName });
    for (const m of entry.morphs) {
      if (!m.isMorph || !m.name) continue;
      add({ domain: "ability", name: m.name, cap: null, className, context: `${entry.name} morph`, category, line: lineName });
    }
  }
  for (const { entry } of safe(() => getScripts(), [])) {
    const slot = SLOT_WORD[entry.slot] ?? "Script";
    add({ domain: "script", name: entry.name, cap: null, className: null, context: slot, category: slot });
  }
  return out;
}

/** Characters with only the fields the dailies board reads. */
export function dailiesCharacters(): Character[] {
  const byId = new Map(roster().map((c) => [c.id, c]));
  const rows = safe(
    () =>
      getDb()
        .prepare("SELECT id, json_extract(json, '$.dailies') AS dailies FROM characters")
        .all() as { id: string; dailies: string | null }[],
    [],
  );
  const out: Character[] = [];
  for (const c of byId.values()) {
    const row = rows.find((r) => r.id === c.id);
    let dailies: CharacterDailies | null = null;
    if (row?.dailies) dailies = safe(() => JSON.parse(row.dailies as string) as CharacterDailies, null);
    out.push({ ...c, dailies });
  }
  return out;
}

/** Characters with only research, motifs and recipe lists filled in. */
export function craftingCharacters(): Character[] {
  const rows = safe(
    () =>
      getDb()
        .prepare(
          `SELECT id,
                  json_extract(json, '$.research') AS research,
                  json_extract(json, '$.motifs') AS motifs,
                  json_extract(json, '$.recipeLists') AS recipeLists,
                  json_array_length(COALESCE(json_extract(json, '$.scribingScripts'), '[]')) AS scripts
           FROM characters`,
        )
        .all() as { id: string; research: string | null; motifs: string | null; recipeLists: string | null; scripts: number }[],
    [],
  );
  const byId = new Map(rows.map((r) => [r.id, r]));
  return roster().map((c) => {
    const r = byId.get(c.id);
    const parse = <T,>(v: string | null | undefined, fallback: T): T => (v ? safe(() => JSON.parse(v) as T, fallback) : fallback);
    return {
      ...c,
      research: parse(r?.research, { crafts: [] }),
      motifs: parse(r?.motifs, []),
      recipeLists: parse(r?.recipeLists, []),
      scribingScripts: Array.from({ length: r?.scripts ?? 0 }, () => ""),
    };
  });
}
