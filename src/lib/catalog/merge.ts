/** How two catalog entries for the same thing combine. */
import type { CatalogDomain } from "./schema";

/** True for values we treat as "not provided" and therefore don't overwrite with. */
export function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** Merge `next` over `prev`, keeping `prev`'s value wherever `next` is empty. */
export function mergeEntry(prev: Record<string, unknown>, next: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...prev };
  for (const [k, v] of Object.entries(next)) {
    if (!isEmpty(v)) out[k] = v;
    else if (!(k in out)) out[k] = v;
  }
  return out;
}


/** The category / subcategory columns for an entry, as `push` files them. */
export function columnsOf(
  domain: CatalogDomain,
  e: Record<string, unknown>,
  fallback: { category: string | null; subcategory: string | null },
): { category: string | null; subcategory: string | null } {
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  switch (domain) {
    case "skillline":
      return { category: str(e.category), subcategory: str(e.className) };
    case "skill":
      return { category: str(e.lineId), subcategory: str(e.type) };
    case "set":
      return { category: str(e.category), subcategory: str(e.dlc) };
    default:
      // Only the two columns: callers pass a whole row as the fallback, and its json must not come back.
      return { category: fallback.category, subcategory: fallback.subcategory };
  }
}

