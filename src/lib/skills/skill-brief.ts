import type { CatalogSource } from "../catalog/schema";

/** One skill tooltip. The description is copied from a snapshot or the catalog, never written here. */
export interface SkillBrief {
  name: string;
  description: string;
  source: CatalogSource;
}

export interface SkillText {
  name: string;
  description?: string | null;
  source?: CatalogSource;
}

/**
 * Catalog text first, then a snapshot description replaces it. An empty
 * snapshot field leaves the catalog line in place. Matching is the exact
 * name, ignoring case only — a shorter name must not steal another skill.
 */
export function collectSkillBriefs(catalog: readonly SkillText[], snapshot: readonly SkillText[]): SkillBrief[] {
  const byName = new Map<string, SkillBrief>();
  for (const item of catalog) {
    const name = item.name.trim();
    const description = item.description?.trim() ?? "";
    const key = name.toLowerCase();
    if (!name || !description || !item.source || byName.has(key)) continue;
    byName.set(key, { name, description, source: item.source });
  }
  for (const item of snapshot) {
    const name = item.name.trim();
    const description = item.description?.trim() ?? "";
    const key = name.toLowerCase();
    if (!name || !description) continue;
    byName.set(key, { name, description, source: "ingame" });
  }
  return [...byName.values()];
}

export function lookupSkillBrief(skills: readonly SkillBrief[], name: string | null | undefined): SkillBrief | null {
  const key = name?.trim().toLowerCase();
  if (!key) return null;
  return skills.find((skill) => skill.name.toLowerCase() === key) ?? null;
}

export function briefsFromLore(
  names: Iterable<string>,
  lore: ReadonlyMap<string, { description: string; source: CatalogSource }>,
  snapshot: readonly SkillText[] = [],
): SkillBrief[] {
  const catalog: SkillText[] = [];
  const seen = new Set<string>();
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    const hit = lore.get(key);
    const description = hit?.description?.trim() ?? "";
    if (!description) continue;
    catalog.push({ name, description, source: hit?.source });
  }
  return collectSkillBriefs(catalog, snapshot);
}

/** The card to show. A description passed with the skill wins over the catalog. */
export function skillTip(
  skills: readonly SkillBrief[],
  request: { name?: string | null; description?: string | null; source?: CatalogSource | "unknown" | null },
): { name: string; description: string; source: CatalogSource | null } | null {
  const name = request.name?.trim() ?? "";
  const explicit = request.description?.trim() ?? "";
  if (explicit) {
    const source = request.source && request.source !== "unknown" ? request.source : null;
    return { name: name || "Skill", description: explicit, source };
  }
  const found = lookupSkillBrief(skills, name);
  if (found) return { name: found.name, description: found.description, source: found.source };
  if (!name) return null;
  return { name, description: "", source: null };
}
