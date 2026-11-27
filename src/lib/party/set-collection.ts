/**
 * The set collection's category tree and its search, kept pure so the page
 * can search every category on the server and land on the right one.
 */

export interface CollectionSet {
  setId: number;
  name: string;
  category: string;
  subcategory?: string | null;
  categoryOrder?: number | null;
  subOrder?: number | null;
  collected: number;
  total: number;
  pieces: { name?: string | null }[];
}

export interface CategoryNode {
  name: string;
  collected: number;
  total: number;
  sets: number;
  subs: { name: string; collected: number; total: number; sets: number }[];
}

/** Categories in the game's order, each with its zones. */
export function categoryTree(sets: CollectionSet[]): CategoryNode[] {
  const cats = new Map<string, CategoryNode & { order: number; subOrder: Map<string, number> }>();
  for (const s of sets) {
    const name = s.category || "Other";
    let c = cats.get(name);
    if (!c) {
      c = { name, collected: 0, total: 0, sets: 0, subs: [], order: s.categoryOrder ?? 9999, subOrder: new Map() };
      cats.set(name, c);
    }
    c.order = Math.min(c.order, s.categoryOrder ?? 9999);
    c.collected += s.collected;
    c.total += s.total;
    c.sets += 1;
    if (s.subcategory) {
      let sub = c.subs.find((x) => x.name === s.subcategory);
      if (!sub) {
        sub = { name: s.subcategory, collected: 0, total: 0, sets: 0 };
        c.subs.push(sub);
        c.subOrder.set(s.subcategory, s.subOrder ?? 9999);
      }
      sub.collected += s.collected;
      sub.total += s.total;
      sub.sets += 1;
    }
  }
  return [...cats.values()]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map(({ subOrder, ...c }) => ({
      name: c.name,
      collected: c.collected,
      total: c.total,
      sets: c.sets,
      subs: c.subs.sort(
        (a, b) => (subOrder.get(a.name) ?? 0) - (subOrder.get(b.name) ?? 0) || a.name.localeCompare(b.name),
      ),
    }));
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’']/g, "'")
    .toLowerCase();

/**
 * Sets matching a search, across every category. A set name match ranks
 * above a match on one of its pieces ("Beekeeper's Helm" still finds
 * Beekeeper's Gear), and a name that starts with the search ranks first.
 */
export function searchSets<T extends CollectionSet>(sets: T[], query: string): T[] {
  const q = fold(query.trim());
  if (!q) return [];
  const scored: { s: T; score: number }[] = [];
  for (const s of sets) {
    const name = fold(s.name);
    let score = -1;
    if (name === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (name.includes(q)) score = 2;
    else if (s.pieces.some((p) => p.name && fold(p.name).includes(q))) score = 3;
    if (score >= 0) scored.push({ s, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.s.name.localeCompare(b.s.name)).map((x) => x.s);
}
