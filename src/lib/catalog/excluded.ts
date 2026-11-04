import type { Database } from "better-sqlite3";

/**
 * Vengeance is a no-CP Cyrodiil mode. Its skill lines (the line named
 * "Vengeance", every "Vengeance …" line, and anything filed under that skill
 * type) are not part of the account Nirnside tracks. The addons skip them,
 * imports drop them, and anything an older snapshot already stored is removed.
 */

export function isExcludedLineName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return n === "vengeance" || n.startsWith("vengeance ");
}

export function isExcludedSkillCategory(category: string | null | undefined): boolean {
  return (category ?? "").trim().toLowerCase() === "vengeance";
}

export function isExcludedSkillLine(line: { name?: string | null; category?: string | null }): boolean {
  return isExcludedLineName(line.name ?? "") || isExcludedSkillCategory(line.category);
}

/** Catalog ids the addon builds from a Vengeance line name (`line-vengeance`, `line-vengeance-bow`, …). */
export function isExcludedCatalogLineId(id: string): boolean {
  const n = id.trim().toLowerCase();
  return n === "line-vengeance" || n.startsWith("line-vengeance-");
}

export function omitExcludedSkillLines<T extends { name?: string | null; category?: string | null }>(
  lines: readonly T[],
): T[] {
  return lines.filter((line) => !isExcludedSkillLine(line));
}

/** Same object when nothing Vengeance was on it, so callers can skip a rewrite. */
export function stripVengeanceFromCharacter<
  T extends {
    skillLines?: readonly { name?: string | null; category?: string | null }[];
    classMasteries?: readonly string[];
  },
>(character: T): T {
  const skillLines = character.skillLines ? omitExcludedSkillLines(character.skillLines) : undefined;
  const classMasteries = character.classMasteries
    ? character.classMasteries.filter((name) => !isExcludedLineName(name))
    : undefined;
  const linesSame = !character.skillLines || skillLines!.length === character.skillLines.length;
  const masterySame = !character.classMasteries || classMasteries!.length === character.classMasteries.length;
  if (linesSame && masterySame) return character;
  return {
    ...character,
    ...(character.skillLines ? { skillLines } : {}),
    ...(character.classMasteries ? { classMasteries } : {}),
  };
}

/**
 * Drop stored Vengeance skill lines, the abilities that belong to a
 * Vengeance line id, and planner targets aimed at those lines.
 */
export function deleteExcludedCatalogAndGoals(db: Database): void {
  const lineIds = db
    .prepare(
      `SELECT id FROM catalog
       WHERE domain = 'skillline'
         AND (
           lower(trim(name)) = 'vengeance'
           OR lower(trim(name)) LIKE 'vengeance %'
           OR lower(trim(category)) = 'vengeance'
           OR lower(id) = 'line-vengeance'
           OR lower(id) LIKE 'line-vengeance-%'
         )`,
    )
    .all() as { id: string }[];

  db.prepare(
    `DELETE FROM catalog
     WHERE domain = 'skill'
       AND (lower(category) = 'line-vengeance' OR lower(category) LIKE 'line-vengeance-%')`,
  ).run();

  if (lineIds.length > 0) {
    const holders = lineIds.map(() => "?").join(", ");
    db.prepare(`DELETE FROM catalog WHERE domain = 'skillline' AND id IN (${holders})`).run(
      ...lineIds.map((row) => row.id),
    );
  }

  db.prepare(
    `DELETE FROM goals
     WHERE domain = 'skillline'
       AND (lower(trim(target)) = 'vengeance' OR lower(trim(target)) LIKE 'vengeance %')`,
  ).run();
}
