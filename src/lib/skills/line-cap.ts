import catalog from "../../../data/catalog/skills.json";

/**
 * Live rank cap for a skill line.
 *
 * The reference catalog (`data/catalog/skills.json`) is the source for lines
 * it lists — those numbers are the line's own maximum (Assault 10, Soul Magic
 * 6, Legerdemain 20, Thieves Guild 12, …), not a blanket 50. Antiquities lines
 * are not in that seed; their caps are the live progression maximums.
 * Class Mastery is points, not a rank. Unknown lines stay unknown — never
 * guess 50.
 */
const CAPS = new Map<string, number | null>();

for (const line of catalog.skillLines as { name: string; maxRank?: number }[]) {
  const key = line.name.trim().toLowerCase();
  if (!key || CAPS.has(key)) continue;
  CAPS.set(key, typeof line.maxRank === "number" ? line.maxRank : null);
}

const UNLISTED: Record<string, number> = {
  scrying: 10,
  excavation: 10,
};
for (const [name, cap] of Object.entries(UNLISTED)) {
  if (!CAPS.has(name)) CAPS.set(name, cap);
}

export function skillLineCap(name: string): number | null {
  const key = name.trim().toLowerCase();
  if (!key || key === "class mastery" || key === "vengeance") return null;
  if (!CAPS.has(key)) return null;
  return CAPS.get(key) ?? null;
}

/**
 * Move one edge of a skill-line expectation.
 * Extra cannot drop below the mandatory rank; a value under that floor is ignored.
 * Raising mandatory up to or past extra clears the extra segment.
 */
export function editSkillLineRanks(
  mode: "mandatory" | "extra",
  cap: number,
  mandatory: number,
  extra: number,
  raw: number,
): { mandatory: number; extra: number } {
  const rounded = Math.round(raw);
  if (mode === "mandatory") {
    const next = Math.min(cap, Math.max(0, rounded));
    return { mandatory: next, extra: extra > next ? extra : 0 };
  }
  if (rounded < mandatory) return { mandatory, extra };
  const next = Math.min(cap, rounded);
  return { mandatory, extra: next > mandatory ? next : 0 };
}
