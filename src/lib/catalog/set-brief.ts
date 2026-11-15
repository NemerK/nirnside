import type { CatalogSource } from "./schema";

/** The set facts a hover card is allowed to show. Bonuses are the catalog's own text. */
export type SetBrief = {
  id: string;
  name: string;
  setId: number | null;
  category: string;
  maxEquip: number;
  source: CatalogSource;
  bonuses: { pieces: number; text: string }[];
};

export type SetQuery = {
  name?: string | null;
  setId?: number | null;
};

/** "Ring of the Pale Order" and a worn "Pale Order" name the same set. */
export function normalizeSetName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^perfected /, "")
    .replace(/^ring of the /, "")
    .replace(/^the /, "");
}

function hasPhrase(haystack: string, needle: string): boolean {
  if (needle.length < 6) return false;
  const at = haystack.indexOf(needle);
  if (at < 0) return false;
  const before = at === 0 || !/[a-z0-9]/.test(haystack[at - 1] ?? "");
  const after = at + needle.length === haystack.length || !/[a-z0-9]/.test(haystack[at + needle.length] ?? "");
  return before && after;
}

export function lookupSetBrief(sets: readonly SetBrief[], query: SetQuery): SetBrief | null {
  if (query.setId != null && query.setId !== 0) {
    const byId = sets.find((set) => set.setId === query.setId);
    if (byId) return byId;
  }
  const raw = query.name?.trim();
  if (!raw) return null;
  const key = normalizeSetName(raw);
  const exact = sets.find((set) => normalizeSetName(set.name) === key);
  if (exact) return exact;
  const phrase = sets.filter((set) => {
    const catalog = normalizeSetName(set.name);
    return hasPhrase(catalog, key) || hasPhrase(key, catalog);
  });
  if (phrase.length === 0) return null;
  return [...phrase].sort((a, b) => a.name.length - b.name.length)[0] ?? null;
}
