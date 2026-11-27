import "server-only";
import { cache } from "react";
import { getDb, getMeta } from "./index";
import type { AccountSnapshot, AchievementRecord, Character, House, Item, OutfitStyleCategory, SkillLine, StickerbookSet } from "../snapshot/schema";
import { annotateStickerbookSets, collectedPieceKeys, type StickerbookSetView } from "../stickerbook/seen";
import { stickerbookSeenIds } from "../stickerbook/seen-store";
import { archivedOwnerIds, archivedOwnerNames, liveCharacters } from "../snapshot/roster";
import { unionCompletedAchievementIds } from "../game/pithka";
import { isExcludedSkillLine, stripVengeanceFromCharacter } from "../game/vengeance";
import type { AccountSetFacts } from "../catalog/set-brief";

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
  | "houses"
  | "outfitStyles"
  | "mythics"
  | "companions"
  | "bankSpace"
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
 * Roster rows for list pages, from the summary columns the importer writes
 * (see ensureCharacterSummaryColumns). Skill lines keep name and rank only;
 * the full character JSON is never read here.
 */
const loadRoster = cache(function loadRoster(): Character[] {
  const db = getDb();
  try {
    const rows = db
      .prepare(
        `SELECT id, name, class, race, alliance, level, championPoints,
                isVampire, vampireStage, isWerewolf, lastSeen,
                gold, telVar, alliancePoints, classMastery, archivedAt, gender, mundus,
                lines AS skillLines
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
      alliancePoints: number | null;
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
            classMastery?: number | boolean;
          }[];
          lines = parsed
            .filter((l) => l && l.name && !isExcludedSkillLine({ name: l.name, category: l.category }))
            .map((l) => ({
              name: l.name as string,
              category: l.category || "Skill",
              rank: intOr(l.rank),
              subclassed: flag(l.subclassed),
              classMastery: flag(l.classMastery) || (l.name ?? "").toLowerCase() === "class mastery",
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
        research: { crafts: [] },
        motifs: [],
        recipeLists: [],
        wardrobe: null,
        lastSeen: row.lastSeen,
        gold: intOr(row.gold),
        telVar: intOr(row.telVar),
        alliancePoints: intOr(row.alliancePoints),
        dailies: null,
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
        skillLines: c.skillLines.filter((l) => !isExcludedSkillLine(l)).map((l) => ({ ...l, abilities: [] })),
        champion: [],
        equipped: [],
        companions: [],
        research: { crafts: [] },
        motifs: [],
        recipeLists: [],
        wardrobe: null,
        scribingScripts: [],
        classMasteries: [],
        dailies: null,
      };
    });
  }
});

/** Full snapshots. Encyclopedia cross-links need abilities and Champion stars. */
export const getCharactersFull = cache(function getCharactersFull(): Character[] {
  const rows = getDb()
    .prepare("SELECT json FROM characters ORDER BY sortOrder ASC")
    .all() as { json: string }[];
  return rows.map((r) => stripVengeanceFromCharacter(JSON.parse(r.json) as Character));
});

/** The live roster. Deleted characters never reach the database (snapshot/roster.ts withoutDeletedCharacters). */
export function getCharacters(): Character[] {
  return liveCharacters(loadRoster());
}

/** Champion allocations only, for the constellation page. */
export function getChampionAllocations(): { id: string; name: string; champion: Character["champion"] }[] {
  const rows = getDb()
    .prepare(
      `SELECT id, name, json_extract(json, '$.champion') AS champion
       FROM characters
       WHERE COALESCE(archivedAt, 0) = 0
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
  return row ? stripVengeanceFromCharacter(JSON.parse(row.json) as Character) : null;
}

export interface ItemFilters {
  search?: string;
  location?: string;
  quality?: string;
  setName?: string;
  trait?: string;
  owner?: string;
  /** Backpack-tab id (`weapons`, `apparel`, …). */
  bagCategory?: string;
  /** Subfilter id inside that tab (`one-handed`, `food`, …). */
  bagSubtype?: string;
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
  if (filters.bagCategory) {
    items = items.filter((it) => it.bagCategory === filters.bagCategory);
  }
  if (filters.bagSubtype) {
    items = items.filter((it) => it.bagSubtype === filters.bagSubtype);
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
  return {
    locations: col("location"),
    qualities: col("quality"),
    sets: col("setName"),
    traits: col("trait"),
    owners: col("ownerCharacter"),
  };
}

/** One character's bags, matching id when present. */
export function getItemsForCharacter(c: Character): Item[] {
  return getItems({ owner: c.name }).filter((it) => {
    if (it.ownerCharacterId) return it.ownerCharacterId === c.id;
    return it.ownerCharacter === c.name;
  });
}

function parseAccountBonuses(value: unknown): { pieces: number; text: string }[] {
  let rows: unknown = value;
  if (typeof value === "string") {
    try {
      rows = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(rows)) return [];
  const bonuses: { pieces: number; text: string }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const pieces = Number((row as { pieces?: unknown }).pieces);
    const text = (row as { text?: unknown }).text;
    if (!Number.isFinite(pieces) || typeof text !== "string" || text.trim() === "") continue;
    bonuses.push({ pieces, text: text.trim() });
  }
  return bonuses;
}

/** Every collection set on this account, including bonus lines once a snapshot stored them. */
export function listAccountSets(): AccountSetFacts[] {
  const rows = getDb()
    .prepare(
      `SELECT setId, name, category,
              json_extract(json, '$.maxEquip') AS maxEquip,
              json_extract(json, '$.bonuses') AS bonuses
       FROM stickerbook`,
    )
    .all() as {
    setId: number;
    name: string;
    category: string | null;
    maxEquip: number | null;
    bonuses: string | null;
  }[];
  return rows
    .filter((row) => row.name.trim().length > 0)
    .map((row) => ({
      name: row.name,
      setId: row.setId,
      category: row.category?.trim() || "Unknown",
      maxEquip: typeof row.maxEquip === "number" && row.maxEquip > 0 ? row.maxEquip : null,
      bonuses: parseAccountBonuses(row.bonuses),
    }));
}

export function getStickerbook(): StickerbookSetView[] {
  const rows = getDb()
    .prepare("SELECT json, total, collected FROM stickerbook ORDER BY category ASC, name ASC")
    .all() as { json: string; total: number; collected: number }[];
  const sets = rows.map((r) => ({ ...(JSON.parse(r.json) as StickerbookSet), total: r.total, collected: r.collected }));
  const account = getAccount()?.displayName ?? "";
  const seen = stickerbookSeenIds(account, collectedPieceKeys(sets));
  return annotateStickerbookSets(sets, seen);
}

export function getStickerbookStats(): { total: number; collected: number; sets: number } {
  const row = getDb()
    .prepare("SELECT COALESCE(SUM(total),0) total, COALESCE(SUM(collected),0) collected, COUNT(*) sets FROM stickerbook")
    .get() as { total: number; collected: number; sets: number };
  return row;
}

export function getItemCount(): number {
  // Count in SQL — never parse thousands of item JSON blobs just for a number.
  // The WHERE mirrors getItems()'s archived-owner filter exactly:
  //   !ownerCharacter || (!archived(ownerCharacter) && (!ownerCharacterId || !archived(ownerCharacterId)))
  // ownerCharacterId is not a table column — it lives in the item JSON.
  const all = loadRoster();
  const names = [...archivedOwnerNames(all)];
  const ids = [...archivedOwnerIds(all)];
  const notIn = (col: string, list: string[]) =>
    list.length ? `${col} NOT IN (${list.map(() => "?").join(", ")})` : "1=1";
  const ownerId = "json_extract(json, '$.ownerCharacterId')";
  const where = `ownerCharacter IS NULL OR (
    ${notIn("ownerCharacter", names)}
    AND (${ownerId} IS NULL OR ${ownerId} = '' OR ${notIn(ownerId, ids)})
  )`;
  const row = getDb()
    .prepare(`SELECT COUNT(*) c FROM items WHERE ${where}`)
    .get(...names, ...ids) as { c: number };
  return row.c;
}

/** Unlocked houses on this account. Empty means none owned, or an older addon. */
export function getHouses(): House[] {
  return getAccount()?.houses ?? [];
}

/** Collections → Outfit Styles. Empty means none listed, or an older addon. */
export function getOutfitStyles(): OutfitStyleCategory[] {
  return getAccount()?.outfitStyles ?? [];
}
