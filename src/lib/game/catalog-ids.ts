/**
 * One id per thing in the game catalog.
 *
 * Every catalog row is filed under the id these rules give it, whatever id
 * a scan or a seed sent (catalog/import.ts), and rows stored under any other
 * id are folded into it on load (catalog/heal.ts). So the same line, ability,
 * set or star can never be stored twice.
 *
 * Why: ids used to be built separately by the catalog addon and by hand in
 * the seeds, from names. They disagreed on apostrophes ("Mother's Sorrow":
 * set-mother-s-sorrow vs set-mothers-sorrow), on a leading "The", and on
 * whole names, and the catalog never forgets, so every disagreement left two
 * rows for one thing.
 *
 * The rule: a kind prefix, then the name, lowercase, accents and apostrophes
 * dropped, every other run of non-letters a hyphen.
 * - skill lines: skillLineId (Class Mastery's carries its class);
 * - abilities "sk-", sets "set-", scripts "scr-", grimoires "grim-",
 *   Mundus "mundus-";
 * - Champion stars "cp-" + the star's name only: a star's name is unique in
 *   the game, and its constellation is a fact about it, not part of its id;
 * - achievements and dishes keep the id they came with (dishes are keyed by
 *   the game's item id).
 */
import type { CatalogDomain } from "../catalog/schema";

export function catalogSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A skill line's id. Class Mastery is one tree per class under one name, so
 * its id carries the class ("line-class-mastery-templar"); without a class
 * there is no id for it (null).
 */
export function skillLineId(name: string, className?: string | null): string | null {
  const base = `line-${catalogSlug(name)}`;
  if (base !== "line-class-mastery") return base;
  return className?.trim() ? `${base}-${catalogSlug(className)}` : null;
}

const PREFIX: Partial<Record<CatalogDomain, string>> = {
  skill: "sk-",
  set: "set-",
  cp: "cp-",
  script: "scr-",
  grimoire: "grim-",
  mundus: "mundus-",
};

/** The id a catalog entry belongs under; null when it has none (Class Mastery without a class). */
export function catalogId(
  domain: CatalogDomain,
  entry: { id: string; name: string; className?: string | null },
): string | null {
  if (domain === "skillline") return skillLineId(entry.name, entry.className);
  const prefix = PREFIX[domain];
  return prefix ? `${prefix}${catalogSlug(entry.name)}` : entry.id;
}
