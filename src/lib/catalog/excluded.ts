/**
 * Live-game skill lines Nirnside deliberately does not track.
 *
 * The PvP "Vengeance" abilities are combat-provided, not levelable — no rank,
 * nothing to plan, nothing to browse. The addon faithfully records whatever
 * the game lists (snapshots and in-game catalog scans are truth), so the app
 * filters these lines at every boundary instead: catalog imports skip them,
 * the startup seed prunes any that an earlier in-game scan stored, and every
 * skill-line surface (planner, focus, character sheets) hides them.
 */
export const EXCLUDED_SKILL_LINES = ["vengeance"];

export function isExcludedLineName(name: string): boolean {
  const n = name.trim().toLowerCase();
  return EXCLUDED_SKILL_LINES.includes(n);
}

/** The catalog line ids these names produce (the addon slugs line names). */
export function excludedLineIds(): string[] {
  return EXCLUDED_SKILL_LINES.map((n) => `line-${n.replace(/[^a-z0-9]+/g, "-")}`);
}
