import { getDb } from "./index";
import { mergeLearned, type LearnedItem } from "../game/item-index";
import { setProfileFrom, type SetProfile } from "../game/set-profile";

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

/**
 * What every set comes in, by set id: the sticker book's full piece list
 * (every piece the game has for the set), plus pieces learned in play.
 */
export function setProfiles(): Map<number, SetProfile> {
  const db = getDb();
  const out = new Map<number, SetProfile>();
  const sticker = db
    .prepare("SELECT setId, json_extract(json, '$.pieces') AS pieces FROM stickerbook")
    .all() as { setId: number; pieces: string | null }[];
  const learned = new Map<number, string[]>();
  for (const r of db.prepare("SELECT setId, kind FROM game_items WHERE setId IS NOT NULL AND kind IS NOT NULL").all() as {
    setId: number;
    kind: string;
  }[]) {
    learned.set(r.setId, [...(learned.get(r.setId) ?? []), r.kind]);
  }
  const ids = new Set([...sticker.map((r) => r.setId), ...learned.keys()]);
  const piecesBySet = new Map(sticker.map((r) => [r.setId, parsePieces(r.pieces)]));
  for (const id of ids) {
    const profile = setProfileFrom(piecesBySet.get(id) ?? [], learned.get(id) ?? []);
    if (profile.shape !== "unknown") out.set(id, profile);
  }
  return out;
}

function parsePieces(json: string | null): { type?: string | null; weight?: string | null }[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

