import type { Database } from "better-sqlite3";

/** The database side of the Vengeance rule (game/vengeance.ts). */
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
