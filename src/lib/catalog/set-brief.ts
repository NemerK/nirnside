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

/** A set the account or the catalog already knows by name. */
export type KnownSet = {
  name: string;
  setId?: number | null;
};

/**
 * Set facts the stickerbook already has for every collection set. Bonuses are
 * the game's own lines once a snapshot has read them, never a paraphrase.
 */
export type AccountSetFacts = {
  name: string;
  setId: number | null;
  category: string;
  maxEquip: number | null;
  bonuses: { pieces: number; text: string }[];
};

export type KnownSetIndex = {
  /** Folded name or alias → the set we should display. */
  byName: Map<string, KnownSet>;
  /** Distinct sets. A real stickerbook is far larger than the seed catalog. */
  count: number;
};

/**
 * Below this many known sets we still guess from the piece name. A full
 * stickerbook is the authority: a name it does not contain is not a set.
 */
const TRUST_KNOWN_SETS = 40;

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
}

/** "Ring of the Pale Order" and a worn "Pale Order" name the same set. */
export function normalizeSetName(name: string): string {
  return fold(name).replace(/^perfected /, "").replace(/^ring of the /, "").replace(/^the /, "");
}

export function indexKnownSets(sets: readonly KnownSet[]): KnownSetIndex {
  const primary = new Map<string, KnownSet>();
  const byName = new Map<string, KnownSet>();
  for (const set of sets) {
    const name = set.name?.trim() ?? "";
    if (name.length < 4) continue;
    const key = fold(name);
    if (primary.has(key)) continue;
    const entry: KnownSet = { name, setId: set.setId ?? null };
    primary.set(key, entry);
    byName.set(key, entry);
    const alias = normalizeSetName(name);
    if (alias !== key && alias.length >= 4 && !byName.has(alias)) byName.set(alias, entry);
  }
  return { byName, count: primary.size };
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
  "healing staff",
  "inferno staff",
  "frost staff",
  "great helm",
  "ice staff",
  "greatsword",
  "battle axe",
  "handwraps",
  "faceguard",
  "arm cops",
  "epaulets",
  "pauldrons",
  "pauldron",
  "sabatons",
  "gauntlets",
  "bracers",
  "breeches",
  "breastplate",
  "chausses",
  "sollerets",
  "greathelm",
  "cuirass",
  "necklace",
  "hauberk",
  "circlet",
  "epaulet",
  "pendant",
  "amulet",
  "choker",
  "helmet",
  "shoulders",
  "shoulder",
  "greaves",
  "girdle",
  "guards",
  "gloves",
  "dagger",
  "shield",
  "visage",
  "casque",
  "staff",
  "sword",
  "shirt",
  "guise",
  "mace",
  "maul",
  "coat",
  "coif",
  "cowl",
  "mask",
  "bow",
  "axe",
  "boots",
  "shoes",
  "jerkin",
  "visor",
  "jack",
  "robe",
  "helm",
  "belt",
  "sash",
  "ring",
  "hat",
  "hood",
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

/** Full item name first, then the piece-pattern guesses, without duplicates. */
function associationCandidates(itemName: string): string[] {
  const raw = itemName.trim();
  if (!raw) return [];
  const out: string[] = [];
  const push = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 4) return;
    const key = fold(trimmed);
    if (out.some((existing) => fold(existing) === key)) return;
    out.push(trimmed);
  };
  push(raw);
  push(raw.replace(/^perfected\s+/i, ""));
  for (const candidate of setNameCandidates(raw)) push(candidate);
  return out;
}

function lookupKnown(known: KnownSetIndex, name: string): KnownSet | undefined {
  return known.byName.get(fold(name)) ?? known.byName.get(normalizeSetName(name));
}

/**
 * The set an item belongs to. A stored snapshot name wins. Otherwise the item
 * name is matched against every set the account or catalog already has, so a
 * mythic whose name is the whole item ("Thrassian Stranglers", "Spaulder of
 * Ruin") is included along with ordinary "set + piece" gear. A repair kit or
 * a crafting material is not a set once the stickerbook is the authority.
 */
export function resolveItemSet(
  item: { name?: string | null; setName?: string | null; setId?: number | null },
  known: KnownSetIndex | null,
): { name: string | null; setId: number | null } {
  const storedId = item.setId != null && item.setId !== 0 ? item.setId : null;
  const stored = item.setName?.trim() || "";
  if (stored) {
    const hit = known ? lookupKnown(known, stored) : undefined;
    return { name: stored, setId: storedId ?? hit?.setId ?? null };
  }
  const itemName = item.name?.trim() || "";
  if (itemName && known && known.count > 0) {
    for (const candidate of associationCandidates(itemName)) {
      const hit = known.byName.get(fold(candidate));
      if (hit) return { name: hit.name, setId: storedId ?? hit.setId ?? null };
    }
  }
  if (!known || known.count < TRUST_KNOWN_SETS) {
    return { name: inferSetName(itemName), setId: storedId };
  }
  return { name: null, setId: storedId };
}

export function withResolvedSet<
  T extends { name?: string | null; setName?: string | null; setId?: number | null },
>(item: T, known: KnownSetIndex | null): T {
  const resolved = resolveItemSet(item, known);
  const currentName = item.setName?.trim() || null;
  const currentId = item.setId != null && item.setId !== 0 ? item.setId : null;
  if (currentName === resolved.name && currentId === resolved.setId) return item;
  return { ...item, setName: resolved.name, setId: resolved.setId };
}

/**
 * Catalog briefs, plus one card for every stickerbook set the catalog does not
 * list. In-game bonus lines replace reference paraphrases. An empty stickerbook
 * bonus list leaves a reference description in place.
 */
export function briefsForHover(catalog: readonly SetBrief[], account: readonly AccountSetFacts[]): SetBrief[] {
  const out = catalog.map((set) => ({ ...set, bonuses: set.bonuses.map((bonus) => ({ ...bonus })) }));
  const byId = new Map<number, SetBrief>();
  const byName = new Map<string, SetBrief>();
  for (const set of out) {
    if (set.setId != null && set.setId !== 0) byId.set(set.setId, set);
    byName.set(fold(set.name), set);
    byName.set(normalizeSetName(set.name), set);
  }
  for (const set of account) {
    const name = set.name.trim();
    if (!name) continue;
    const existing =
      (set.setId != null && set.setId !== 0 ? byId.get(set.setId) : undefined) ??
      byName.get(fold(name)) ??
      byName.get(normalizeSetName(name));
    if (!existing) {
      const brief: SetBrief = {
        id: `account-set-${set.setId ?? fold(name)}`,
        name,
        setId: set.setId,
        category: set.category || "Unknown",
        maxEquip: set.maxEquip ?? 0,
        source: "ingame",
        bonuses: set.bonuses.map((bonus) => ({ ...bonus })),
      };
      out.push(brief);
      if (brief.setId != null && brief.setId !== 0) byId.set(brief.setId, brief);
      byName.set(fold(name), brief);
      byName.set(normalizeSetName(name), brief);
      continue;
    }
    if (set.bonuses.length > 0 && (existing.source !== "ingame" || existing.bonuses.length === 0)) {
      existing.bonuses = set.bonuses.map((bonus) => ({ ...bonus }));
      existing.source = "ingame";
    }
    if ((existing.setId == null || existing.setId === 0) && set.setId) existing.setId = set.setId;
    if (existing.maxEquip <= 0 && set.maxEquip) existing.maxEquip = set.maxEquip;
  }
  return out;
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
  const lower = withoutPerfected.toLowerCase().replace(/[’‘]/g, "'");
  for (const word of PIECE_WORDS) {
    const possessive = `'s ${word}`;
    const plain = ` ${word}`;
    const cut = lower.endsWith(possessive) ? possessive.length : lower.endsWith(plain) ? plain.length : 0;
    if (cut === 0) continue;
    const setName = withoutPerfected.slice(0, -cut).replace(/['’]s$/i, "").trim();
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
