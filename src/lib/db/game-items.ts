import { getDb } from "./index";
import { mergeLearned, type LearnedItem } from "../game/item-index";

interface Row {
  itemId: number;
  name: string;
  icon: string | null;
  kind: string | null;
  setId: number | null;
  setName: string | null;
  seenIn: string;
  firstSeen: number;
  lastSeen: number;
}

const toItem = (r: Row): LearnedItem & { firstSeen: number; lastSeen: number } => ({
  itemId: r.itemId,
  name: r.name,
  icon: r.icon,
  kind: r.kind,
  setId: r.setId,
  setName: r.setName,
  seenIn: safeArray(r.seenIn),
  firstSeen: r.firstSeen,
  lastSeen: r.lastSeen,
});

function safeArray(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Add a scan's items to what is known. Existing facts stay; gaps fill in; nothing is removed. */
export function learnItems(items: LearnedItem[], at: number = Math.floor(Date.now() / 1000)): number {
  if (items.length === 0) return 0;
  const db = getDb();
  const get = db.prepare("SELECT * FROM game_items WHERE itemId = ?");
  const put = db.prepare(
    `INSERT INTO game_items (itemId, name, icon, kind, setId, setName, seenIn, firstSeen, lastSeen)
     VALUES (@itemId, @name, @icon, @kind, @setId, @setName, @seenIn, @firstSeen, @lastSeen)
     ON CONFLICT(itemId) DO UPDATE SET name = @name, icon = @icon, kind = @kind, setId = @setId,
       setName = @setName, seenIn = @seenIn, lastSeen = @lastSeen`,
  );
  const tx = db.transaction(() => {
    for (const seen of items) {
      const row = get.get(seen.itemId) as Row | undefined;
      const known = row ? toItem(row) : undefined;
      const next = mergeLearned(known, seen);
      put.run({ ...next, seenIn: JSON.stringify(next.seenIn), firstSeen: known?.firstSeen ?? at, lastSeen: at });
    }
  });
  tx();
  return items.length;
}

export function getLearnedItem(itemId: number) {
  const row = getDb().prepare("SELECT * FROM game_items WHERE itemId = ?").get(itemId) as Row | undefined;
  return row ? toItem(row) : null;
}

/** Every known piece of a set, by the game's set id. */
export function learnedItemsForSet(setId: number) {
  return (getDb().prepare("SELECT * FROM game_items WHERE setId = ? ORDER BY kind, name").all(setId) as Row[]).map(toItem);
}

export function learnedItemCount(): number {
  return (getDb().prepare("SELECT COUNT(*) AS n FROM game_items").get() as { n: number }).n;
}
