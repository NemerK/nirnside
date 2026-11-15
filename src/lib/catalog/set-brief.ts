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
  /** Worn item name, used when the snapshot did not store a set name. */
  itemName?: string | null;
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

/** Gear words that follow a set name, longest first so "inferno staff" wins over "staff". */
const PIECE_WORDS = [
  "lightning staff",
  "restoration staff",
  "inferno staff",
  "ice staff",
  "greatsword",
  "battle axe",
  "arm cops",
  "epaulets",
  "pauldrons",
  "pauldron",
  "sabatons",
  "gauntlets",
  "bracers",
  "breeches",
  "breastplate",
  "cuirass",
  "necklace",
  "amulet",
  "helmet",
  "shoulders",
  "shoulder",
  "greaves",
  "guards",
  "gloves",
  "dagger",
  "shield",
  "staff",
  "sword",
  "mace",
  "maul",
  "bow",
  "axe",
  "boots",
  "shoes",
  "jerkin",
  "jack",
  "robe",
  "helm",
  "hat",
  "hood",
  "mask",
  "belt",
  "sash",
  "ring",
];

function isPieceWord(value: string): boolean {
  return PIECE_WORDS.includes(value.trim().toLowerCase());
}

/**
 * The set name written into an item, when the snapshot left setName empty.
 * "Aetheric Lancer Bracers" and "Perfected Helmet of Sul-Xan's Torment" both
 * name their set. A repair kit or a food does not.
 */
export function inferSetName(itemName: string | null | undefined): string | null {
  return setNameCandidates(itemName)[0] ?? null;
}

function setNameCandidates(itemName: string | null | undefined): string[] {
  const raw = itemName?.trim();
  if (!raw) return [];
  const withoutPerfected = raw.replace(/^perfected\s+/i, "");
  const ofMatch = /^(.*?)\s+of\s+(?:the\s+)?(.+)$/i.exec(withoutPerfected);
  if (ofMatch && isPieceWord(ofMatch[1] ?? "")) {
    const right = (ofMatch[2] ?? "").trim();
    if (right.length < 4) return [];
    const fullOf = withoutPerfected.match(/^ring\s+of\s+the\s+/i) ? [withoutPerfected] : [];
    return [...fullOf, right];
  }
  const lower = withoutPerfected.toLowerCase();
  for (const word of PIECE_WORDS) {
    const possessive = `'s ${word}`;
    const plain = ` ${word}`;
    const cut = lower.endsWith(possessive) ? possessive.length : lower.endsWith(plain) ? plain.length : 0;
    if (cut === 0) continue;
    const setName = withoutPerfected.slice(0, -cut).replace(/'s$/i, "").trim();
    if (setName.length < 4 || isPieceWord(setName)) return [];
    return [setName];
  }
  return [];
}

function matchNamed(sets: readonly SetBrief[], query: SetQuery): SetBrief | null {
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

export function lookupSetBrief(sets: readonly SetBrief[], query: SetQuery): SetBrief | null {
  const named = matchNamed(sets, query);
  if (named) return named;
  // A stored set name that the catalog does not know stays unmatched. Guessing
  // from the item name would replace a real set with a different one.
  if (query.name?.trim()) return null;
  for (const candidate of setNameCandidates(query.itemName)) {
    const found = matchNamed(sets, { name: candidate });
    if (found) return found;
  }
  return null;
}
