import { ESO_CLASSES } from "../classes";

/**
 * Classes and their skill lines, and what a character's class lines say.
 *
 * - Each class has three class skill lines. Which line belongs to which
 *   class comes from the catalog (the in-game scan writes the game's own
 *   answer; the shipped reference data is the fallback).
 * - Subclassing (live since Update 46, 2025): a character may replace up
 *   to two of its own class lines with lines from other classes, must keep
 *   at least one of its own, and may take only one line from any other
 *   class. Borrowed lines level separately, account-wide. Sources: ZOS
 *   patch notes and community guides (eso-hub, Alcast, Hyperioxes).
 * - Class Mastery is hidden while a character is subclassing and returns
 *   when all three native lines are equipped again (Update 50).
 *
 * The rules can move with patches, so they are data here, and the scan's
 * own flags (from IsPlayerClassSkillLine / IsActive) are what a character
 * is judged by: the model explains, it doesn't overrule the game.
 */

export const CLASSES = ESO_CLASSES;
export type ClassName = (typeof CLASSES)[number];

export const SUBCLASSING = {
  /** Most of a character's own class lines that can be swapped out. */
  maxReplaced: 2,
  /** Own class lines that must stay equipped. */
  minNative: 1,
  /** Lines one character may borrow from any single other class. */
  perOtherClass: 1,
  since: "Update 46 (2025)",
} as const;

export interface ClassLineRef {
  name: string;
  className: string | null;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/[’']/g, "'");

/** Class → its three lines, from catalog skill lines (or any list that carries className). */
export function classLineMap(lines: readonly ClassLineRef[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const l of lines) {
    if (!l.className) continue;
    const list = out.get(l.className) ?? [];
    if (!list.some((x) => norm(x) === norm(l.name))) list.push(l.name);
    out.set(l.className, list);
  }
  return out;
}

/** Which class a skill line belongs to; null for non-class lines. */
export function classOfLine(map: Map<string, string[]>, lineName: string): string | null {
  for (const [cls, lines] of map) if (lines.some((l) => norm(l) === norm(lineName))) return cls;
  return null;
}

export interface CharacterLine {
  name: string;
  category?: string | null;
  subclassed?: boolean;
  active?: boolean | null;
  ownClass?: boolean | null;
  classMastery?: boolean;
}

export interface ClassLineup {
  /** The character's own class lines currently equipped. */
  native: string[];
  /** Own class lines swapped out for borrowed ones. */
  swappedOut: string[];
  /** Lines borrowed from other classes, with where they come from. */
  borrowed: { line: string; fromClass: string | null }[];
  subclassing: boolean;
  /** Rules the lineup breaks, in words; empty when it fits (it always should, coming from the game). */
  problems: string[];
}

/**
 * Read a character's class lines: own, swapped out, borrowed. Uses the
 * scan's flags when present (newer addons), else the catalog's class map.
 */
export function classLineup(
  characterClass: string,
  lines: readonly CharacterLine[],
  map: Map<string, string[]>,
): ClassLineup {
  const ownLines = map.get(characterClass) ?? [];
  const isOwn = (l: CharacterLine) =>
    l.ownClass ?? (l.subclassed ? false : ownLines.some((o) => norm(o) === norm(l.name)));
  const classLines = lines.filter(
    (l) => !l.classMastery && (l.subclassed || l.ownClass != null || classOfLine(map, l.name) != null || /^class/i.test(l.category ?? "")),
  );
  // Borrowed: the game flags it (subclassed), or it is another class's line that is equipped.
  const borrowed = classLines
    .filter((l) => l.subclassed || (l.ownClass === false && l.active === true))
    .map((l) => ({ line: l.name, fromClass: classOfLine(map, l.name) }));
  const nativeAll = ownLines.length > 0 ? ownLines : classLines.filter(isOwn).map((l) => l.name);
  const swappedOut = nativeAll.filter((name) => {
    const l = lines.find((x) => norm(x.name) === norm(name));
    return l?.active === false;
  });
  // Older scans don't say which native lines are out; then swappedOut stays empty.
  const native = nativeAll.filter((n) => !swappedOut.includes(n));
  const problems: string[] = [];
  if (borrowed.length > SUBCLASSING.maxReplaced) problems.push(`Borrows ${borrowed.length} lines; the game allows ${SUBCLASSING.maxReplaced}.`);
  const perClass = new Map<string, number>();
  for (const b of borrowed) if (b.fromClass) perClass.set(b.fromClass, (perClass.get(b.fromClass) ?? 0) + 1);
  for (const [cls, n] of perClass) if (n > SUBCLASSING.perOtherClass) problems.push(`Borrows ${n} ${cls} lines; only one per class is allowed.`);
  return { native, swappedOut, borrowed, subclassing: borrowed.length > 0, problems };
}

/** Class Mastery applies only while all three native lines are equipped. */
export function classMasteryAvailable(lineup: ClassLineup): boolean {
  return !lineup.subclassing && lineup.swappedOut.length === 0;
}
