export type SortDir = "asc" | "desc";
export type SortState<K extends string> = { key: K; dir: SortDir } | null;

/** First click sorts ascending, second descending, third clears back to the module's own order. */
export function toggleSort<K extends string>(current: SortState<K>, key: K): SortState<K> {
  if (!current || current.key !== key) return { key, dir: "asc" };
  if (current.dir === "asc") return { key, dir: "desc" };
  return null;
}

/** Blanks stay at the bottom in either direction. Numbers and text compare on their own. */
export function compareSort(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  dir: SortDir,
): number {
  const blank = (value: string | number | null | undefined) => value == null || value === "";
  if (blank(a) && blank(b)) return 0;
  if (blank(a)) return 1;
  if (blank(b)) return -1;
  const base =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), "en", { numeric: true, sensitivity: "base" });
  return dir === "asc" ? base : -base;
}

export function sortRows<T, K extends string>(
  rows: readonly T[],
  sort: SortState<K>,
  value: (row: T, key: K) => string | number | null | undefined,
): T[] {
  if (!sort) return [...rows];
  return [...rows].sort((a, b) => compareSort(value(a, sort.key), value(b, sort.key), sort.dir));
}

/** Higher means further along. Unknown and unscanned sort as blank. */
export function statusRank(status: string | null | undefined): number | null {
  switch (status) {
    case "open":
    case "available":
      return 1;
    case "cooldown":
      return 2;
    case "accepted":
      return 3;
    case "ready":
      return 4;
    case "done":
      return 5;
    default:
      return null;
  }
}
