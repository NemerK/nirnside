import "server-only";
import { cache } from "react";
import { getDb, getMeta } from "./index";
import type { AccountSnapshot, AchievementRecord, Character, Item, SkillLine, StickerbookSet } from "../snapshot/schema";
import { archivedCharacters, archivedOwnerIds, archivedOwnerNames, liveCharacters } from "../snapshot/roster";
import { unionCompletedAchievementIds } from "../achievements/pithka";

export type AccountMeta = Pick<
  AccountSnapshot,
  | "displayName"
  | "region"
  | "apiVersion"
  | "esoPlus"
  | "lastSnapshot"
  | "gold"
  | "currencies"
  | "guilds"
  | "achievements"
  | "completedAchievementIds"
>;

export function getAccount(): AccountMeta | null {
  return getMeta<AccountMeta>("account");
}

/**
 * Account-wide set of completed achievement ids — the authoritative input for
 * the Pithka-style board. Never shrinks: Maelstrom Arena clears are still
 * per-character in the game, so we persist every id we have ever seen.
 */
export function getCompletedAchievementIds(): number[] {
  const db = getDb();
  const fromTable = (db.prepare("SELECT id FROM completed_achievements").all() as { id: number }[]).map(
    (r) => r.id,
  );
  let fromChars: number[] = [];
  try {
    fromChars = (
      db.prepare("SELECT DISTINCT id FROM character_completed_achievements").all() as { id: number }[]
    ).map((r) => r.id);
  } catch {
    fromChars = [];
  }
  const fromMeta = getAccount()?.completedAchievementIds ?? [];
  return unionCompletedAchievementIds(unionCompletedAchievementIds(fromTable, fromChars), fromMeta);
}

/** Account-wide earned achievement names, lowercased for matching. */
export function getEarnedAchievements(): Set<string> {
  const acct = getAccount();
  return new Set((acct?.achievements ?? []).map((a) => a.toLowerCase()));
}

/**
 * Structured trial/dungeon/arena achievements straight from the game. This is
 * the authoritative source for the achievements board — completion here is what
 * ESO reported, never inferred.
 */
export function getAchievementRecords(): AchievementRecord[] {
  const rows = getDb()
    .prepare("SELECT json FROM achievements ORDER BY content ASC, points DESC, name ASC")
    .all() as { json: string }[];
  return rows.map((r) => JSON.parse(r.json) as AchievementRecord);
}

export function hasAchievementRecords(): boolean {
  const row = getDb().prepare("SELECT COUNT(*) c FROM achievements").get() as { c: number };
  return row.c > 0;
}

export interface DataSource {
  kind: "env" | "uploaded" | "eso" | "sample";
  path: string;
  label: string;
  at: number;
  ok: boolean;
  error?: string;
}

export function getDataSource(): DataSource | null {
  return getMeta<DataSource>("dataSource");
}

export interface AutoSetup {
  addOnsDirs: string[];
  changed: number;
  installed: string[];
  updated: string[];
  errors: string[];
  at: number;
}

export function getAutoSetup(): AutoSetup | null {
  return getMeta<AutoSetup>("autoSetup");
}

export function hasData(): boolean {
  return getAccount() !== null;
}

function flag(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function intOr(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/**
 * Roster rows for list pages. Skill lines keep name and rank only — abilities,
 * gear, and wardrobe stay out of the payload so changing pages does not wait
 * on every character's full snapshot.
 */
const loadRoster = cache(function loadRoster(): Character[] {
  const db = getDb();
  try {
    const rows = db
      .prepare(
        `SELECT id, name, class, race, alliance, level, championPoints,
                isVampire, vampireStage, isWerewolf, lastSeen,
                json_extract(json, '$.gold') AS gold,
                json_extract(json, '$.telVar') AS telVar,
                json_extract(json, '$.classMastery') AS classMastery,
                json_extract(json, '$.archivedAt') AS archivedAt,
                json_extract(json, '$.gender') AS gender,
                json_extract(json, '$.mundus') AS mundus,
                (
                  SELECT json_group_array(json_object(
                    'name', json_extract(line.value, '$.name'),
                    'category', IFNULL(json_extract(line.value, '$.category'), ''),
                    'rank', IFNULL(json_extract(line.value, '$.rank'), 0),
                    'subclassed', IFNULL(json_extract(line.value, '$.subclassed'), 0)
                  ))
                  FROM json_each(COALESCE(json_extract(characters.json, '$.skillLines'), '[]')) AS line
                ) AS skillLines
         FROM characters
         ORDER BY sortOrder ASC`,
      )
      .all() as {
      id: string;
      name: string;
      class: string;
      race: string;
      alliance: string;
      level: number;
      championPoints: number;
      isVampire: number;
      vampireStage: number;
      isWerewolf: number;
      lastSeen: number | null;
      gold: number | null;
      telVar: number | null;
      classMastery: number | null;
      archivedAt: number | null;
      gender: string | null;
      mundus: string | null;
      skillLines: string | null;
    }[];

    return rows.map((row) => {
      let lines: SkillLine[] = [];
      if (row.skillLines) {
        try {
          const parsed = JSON.parse(row.skillLines) as {
            name?: string;
            category?: string;
            rank?: number;
            subclassed?: number | boolean;
          }[];
          lines = parsed
            .filter((l) => l && l.name)
            .map((l) => ({
              name: l.name as string,
              category: l.category || "Skill",
              rank: intOr(l.rank),
              subclassed: flag(l.subclassed),
              abilities: [],
            }));
        } catch {
          lines = [];
        }
      }
      const archivedAt = row.archivedAt == null ? null : intOr(row.archivedAt);
      return {
        id: row.id,
        name: row.name,
        class: row.class,
        race: row.race,
        alliance: row.alliance as Character["alliance"],
        gender: row.gender,
        level: row.level,
        championPoints: row.championPoints,
        mundus: row.mundus,
        attributes: {},
        vampire: { isVampire: row.isVampire === 1, stage: row.vampireStage },
        werewolf: { isWerewolf: row.isWerewolf === 1 },
        classMastery: flag(row.classMastery),
        classMasteries: [],
        skillLines: lines,
        champion: [],
        equipped: [],
        companions: [],
        scribingScripts: [],
        research: [],
        wardrobe: null,
        lastSeen: row.lastSeen,
        gold: intOr(row.gold),
        telVar: intOr(row.telVar),
        archivedAt: archivedAt && archivedAt > 0 ? archivedAt : null,
      } satisfies Character;
    });
  } catch {
    // Older SQLite builds without JSON1 still have to parse, but list pages
    // drop the heavy fields before they are sent to the browser.
    const rows = db.prepare("SELECT json FROM characters ORDER BY sortOrder ASC").all() as { json: string }[];
    return rows.map((r) => {
      const c = JSON.parse(r.json) as Character;
      return {
        ...c,
        skillLines: c.skillLines.map((l) => ({ ...l, abilities: [] })),
        champion: [],
        equipped: [],
        companions: [],
        research: [],
        wardrobe: null,
        scribingScripts: [],
        classMasteries: [],
      };
    });
  }
});

/** Full snapshots. Encyclopedia cross-links need abilities and Champion stars. */
export const getCharactersFull = cache(function getCharactersFull(): Character[] {
  const rows = getDb()
    .prepare("SELECT json FROM characters ORDER BY sortOrder ASC")
    .all() as { json: string }[];
  return rows.map((r) => JSON.parse(r.json) as Character);
});

/** Live ESO roster only. Deleted characters are in getArchivedCharacters(). */
export function getCharacters(): Character[] {
  return liveCharacters(loadRoster());
}

export function getArchivedCharacters(): Character[] {
  return archivedCharacters(loadRoster());
}

/** Champion allocations only, for the constellation page. */
export function getChampionAllocations(): { id: string; name: string; champion: Character["champion"] }[] {
  const rows = getDb()
    .prepare(
      `SELECT id, name, json_extract(json, '$.champion') AS champion
       FROM characters
       WHERE COALESCE(json_extract(json, '$.archivedAt'), 0) = 0
       ORDER BY sortOrder ASC`,
    )
    .all() as { id: string; name: string; champion: string | null }[];
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    champion: r.champion ? (JSON.parse(r.champion) as Character["champion"]) : [],
  }));
}

export function getCharacter(id: string): Character | null {
  const row = getDb().prepare("SELECT json FROM characters WHERE id = ?").get(id) as
    | { json: string }
    | undefined;
  return row ? (JSON.parse(row.json) as Character) : null;
}

export interface ItemFilters {
  search?: string;
  location?: string;
  quality?: string;
  setName?: string;
  trait?: string;
  owner?: string;
  /** When true, include bags that belonged to deleted (archived) characters. */
  includeArchived?: boolean;
}

export function getItems(filters: ItemFilters = {}): Item[] {
  const where: string[] = [];
  const params: Record<string, unknown> = {};
  if (filters.search) {
    where.push("(name LIKE @search OR setName LIKE @search)");
    params.search = `%${filters.search}%`;
  }
  if (filters.location) {
    where.push("location = @location");
    params.location = filters.location;
  }
  if (filters.quality) {
    where.push("quality = @quality");
    params.quality = filters.quality;
  }
  if (filters.setName) {
    where.push("setName = @setName");
    params.setName = filters.setName;
  }
  if (filters.trait) {
    where.push("trait = @trait");
    params.trait = filters.trait;
  }
  if (filters.owner) {
    where.push("ownerCharacter = @owner");
    params.owner = filters.owner;
  }
  const sql =
    "SELECT json FROM items" +
    (where.length ? " WHERE " + where.join(" AND ") : "") +
    " ORDER BY name ASC, location ASC LIMIT 5000";
  const rows = getDb().prepare(sql).all(params) as { json: string }[];
  let items = rows.map((r) => JSON.parse(r.json) as Item);
  if (!filters.includeArchived && !filters.owner) {
    const all = loadRoster();
    const names = archivedOwnerNames(all);
    const ids = archivedOwnerIds(all);
    items = items.filter(
      (it) =>
        !it.ownerCharacter ||
        (!names.has(it.ownerCharacter) && (!it.ownerCharacterId || !ids.has(it.ownerCharacterId))),
    );
  }
  return items;
}

export interface FacetValues {
  locations: string[];
  qualities: string[];
  sets: string[];
  traits: string[];
  owners: string[];
}

export function getItemFacets(): FacetValues {
  const db = getDb();
  const col = (c: string) =>
    (db
      .prepare(`SELECT DISTINCT ${c} AS v FROM items WHERE ${c} IS NOT NULL AND ${c} <> '' ORDER BY v ASC`)
      .all() as { v: string }[]).map((r) => r.v);
  const archived = archivedOwnerNames(loadRoster());
  return {
    locations: col("location"),
    qualities: col("quality"),
    sets: col("setName"),
    traits: col("trait"),
    owners: col("ownerCharacter").filter((name) => !archived.has(name)),
  };
}

/** Last-known bags for one character (live or archived), matching id when present. */
export function getItemsForCharacter(c: Character): Item[] {
  return getItems({ owner: c.name, includeArchived: true }).filter((it) => {
    if (it.ownerCharacterId) return it.ownerCharacterId === c.id;
    return it.ownerCharacter === c.name;
  });
}

export function getStickerbook(): (StickerbookSet & { total: number; collected: number })[] {
  const rows = getDb()
    .prepare("SELECT json, total, collected FROM stickerbook ORDER BY category ASC, name ASC")
    .all() as { json: string; total: number; collected: number }[];
  return rows.map((r) => ({ ...(JSON.parse(r.json) as StickerbookSet), total: r.total, collected: r.collected }));
}

export function getStickerbookStats(): { total: number; collected: number; sets: number } {
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(total),0) total, COALESCE(SUM(collected),0) collected, COUNT(*) sets FROM stickerbook")
    .get() as { total: number; collected: number; sets: number };
  return row;
}

export function getItemCount(): number {
  return getItems().length;
}
