import "server-only";
import { getDb, getMeta } from "./index";
import type { AccountSnapshot, Character, Item, StickerbookSet } from "../snapshot/schema";

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
>;

export function getAccount(): AccountMeta | null {
  return getMeta<AccountMeta>("account");
}

/** Account-wide earned achievement names, lowercased for matching. */
export function getEarnedAchievements(): Set<string> {
  const acct = getAccount();
  return new Set((acct?.achievements ?? []).map((a) => a.toLowerCase()));
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

export function getCharacters(): Character[] {
  const rows = getDb()
    .prepare("SELECT json FROM characters ORDER BY sortOrder ASC")
    .all() as { json: string }[];
  return rows.map((r) => JSON.parse(r.json) as Character);
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
  return rows.map((r) => JSON.parse(r.json) as Item);
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
  return {
    locations: col("location"),
    qualities: col("quality"),
    sets: col("setName"),
    traits: col("trait"),
    owners: col("ownerCharacter"),
  };
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
  const row = getDb().prepare("SELECT COUNT(*) c FROM items").get() as { c: number };
  return row.c;
}
