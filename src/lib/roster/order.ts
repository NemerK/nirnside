import { getMeta, setMeta } from "../db";

/**
 * Player-chosen roster order. Presentation only — a snapshot import never
 * rewrites it. Characters missing from the saved list keep their snapshot
 * order at the end.
 */

const KEY = "rosterOrder";

export function getRosterOrder(): string[] {
  try {
    const stored = getMeta<unknown>(KEY);
    if (!Array.isArray(stored)) return [];
    return stored.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return [];
  }
}

export function setRosterOrder(ids: unknown): string[] {
  const list = Array.isArray(ids) ? ids : [];
  const seen = new Set<string>();
  const order: string[] = [];
  for (const id of list) {
    if (typeof id !== "string" || id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }
  setMeta(KEY, order);
  return order;
}

export function applyRosterOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const used = new Set<string>();
  const ordered: T[] = [];
  for (const id of order) {
    const item = byId.get(id);
    if (!item || used.has(id)) continue;
    used.add(id);
    ordered.push(item);
  }
  for (const item of items) {
    if (!used.has(item.id)) ordered.push(item);
  }
  return ordered;
}
