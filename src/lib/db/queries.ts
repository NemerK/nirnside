import "server-only";
import { getDb, getMeta } from "./index";
import type { AccountSnapshot, AchievementRecord, Character, Item, StickerbookSet } from "../snapshot/schema";
import { archivedCharacters, archivedOwnerIds, archivedOwnerNames, liveCharacters } from "../snapshot/roster";

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
  const rows = getDb()
    .prepare("SELECT id FROM completed_achievements ORDER BY id")
    .all() as { id: number }[];
  if (rows.length > 0) return rows.map((r) => r.id);
  return getAccount()?.completedAchievementIds ?? [];
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

function loadAllCharacters(): Character[] {
  const rows = getDb()
    .prepare("SELECT json FROM characters ORDER BY sortOrder ASC")
    .all() as { json: string }[];
  return rows.map((r) => JSON.parse(r.json) as Character);
}

/** Live ESO roster only. Deleted characters are in getArchivedCharacters(). */
export function getCharacters(): Character[] {
  return liveCharacters(loadAllCharacters());
}

export function getArchivedCharacters(): Character[] {
  return archivedCharacters(loadAllCharacters());
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
    const all = loadAllCharacters();
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
  const archived = archivedOwnerNames(loadAllCharacters());
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
