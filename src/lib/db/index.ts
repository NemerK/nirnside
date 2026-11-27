import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { dbFile } from "../data-dir";
import { stripVengeanceFromCharacter } from "../game/vengeance";
import { deleteExcludedCatalogAndGoals } from "./vengeance-cleanup";
import { skillLineCap } from "../game/skill-caps";

/**
 * Local SQLite database. Lives on the user's own disk only (see the privacy
 * rule). Default location is ./data/nirnside.db; override with NIRNSIDE_DB.
 */
const DB_PATH = dbFile();

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  // Fail a blocked read instead of hanging the page forever (the UI then
  // recovers via a real reload). Default busy_timeout is 0.
  db.pragma("busy_timeout = 4000");
  migrate(db);
  _db = db;
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS characters (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      class           TEXT NOT NULL,
      race            TEXT NOT NULL,
      alliance        TEXT NOT NULL,
      level           INTEGER NOT NULL,
      championPoints  INTEGER NOT NULL,
      isVampire       INTEGER NOT NULL DEFAULT 0,
      vampireStage    INTEGER NOT NULL DEFAULT 0,
      isWerewolf      INTEGER NOT NULL DEFAULT 0,
      lastSeen        INTEGER,
      sortOrder       INTEGER NOT NULL DEFAULT 0,
      json            TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      rowid           INTEGER PRIMARY KEY AUTOINCREMENT,
      itemId          INTEGER NOT NULL,
      name            TEXT NOT NULL,
      icon            TEXT,
      quality         TEXT,
      count           INTEGER NOT NULL DEFAULT 1,
      ownerCharacter  TEXT,
      location        TEXT NOT NULL,
      setName         TEXT,
      setId           INTEGER,
      trait           TEXT,
      level           INTEGER,
      equipSlot       TEXT,
      obtainable      INTEGER NOT NULL DEFAULT 1,
      bound           INTEGER NOT NULL DEFAULT 0,
      stolen          INTEGER NOT NULL DEFAULT 0,
      json            TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
    CREATE INDEX IF NOT EXISTS idx_items_set ON items(setName);
    CREATE INDEX IF NOT EXISTS idx_items_loc ON items(location);
    CREATE INDEX IF NOT EXISTS idx_items_owner ON items(ownerCharacter);

    CREATE TABLE IF NOT EXISTS stickerbook (
      setId      INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      category   TEXT NOT NULL,
      total      INTEGER NOT NULL,
      collected  INTEGER NOT NULL,
      json       TEXT NOT NULL
    );

    -- Structured trial/dungeon/arena achievements as the game reports them.
    -- Drives the Pithka-style board directly: completion is never inferred.
    CREATE TABLE IF NOT EXISTS achievements (
      id           INTEGER PRIMARY KEY,
      name         TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      points       INTEGER NOT NULL DEFAULT 0,
      completed    INTEGER NOT NULL DEFAULT 0,
      category     TEXT NOT NULL DEFAULT '',
      content      TEXT NOT NULL DEFAULT '',
      title        TEXT,
      json         TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ach_content ON achievements(content);
    CREATE INDEX IF NOT EXISTS idx_ach_category ON achievements(category);

    -- The shared Tamriel catalog. One row per entry across every domain
    -- (set, skill, skillline, cp, grimoire, script, ...). 'source' encodes the
    -- accuracy rule: 'ingame' > 'community' > 'reference'. On import, higher
    -- precedence sources overwrite lower ones for the same (domain, id).
    CREATE TABLE IF NOT EXISTS catalog (
      domain     TEXT NOT NULL,
      id         TEXT NOT NULL,
      name       TEXT NOT NULL,
      category   TEXT,
      subcategory TEXT,
      source     TEXT NOT NULL DEFAULT 'reference',
      patch      TEXT,
      json       TEXT NOT NULL,
      PRIMARY KEY (domain, id)
    );
    CREATE INDEX IF NOT EXISTS idx_catalog_domain ON catalog(domain);
    CREATE INDEX IF NOT EXISTS idx_catalog_name ON catalog(domain, name);
    CREATE INDEX IF NOT EXISTS idx_catalog_cat ON catalog(domain, category);

    -- Every item the account holds now, plus every piece of the set
    -- collection, by the game's item id (src/lib/game/item-index.ts), with
    -- where it belongs. Each import brings it in line with the scan: an item
    -- sold or destroyed leaves it.
    CREATE TABLE IF NOT EXISTS game_items (
      itemId    INTEGER PRIMARY KEY,
      name      TEXT NOT NULL,
      icon      TEXT,
      kind      TEXT,
      setId     INTEGER,
      setName   TEXT,
      seenIn    TEXT NOT NULL DEFAULT '[]',
      firstSeen INTEGER NOT NULL,
      lastSeen  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_game_items_set ON game_items(setId);
    CREATE INDEX IF NOT EXISTS idx_game_items_kind ON game_items(kind);

    -- Earned Pithka ids. Never deleted: Maelstrom Arena clears are still
    -- per-character, so a later toon's snapshot must not uncheck them.
    CREATE TABLE IF NOT EXISTS completed_achievements (
      id INTEGER PRIMARY KEY
    );
    -- Per-character earned ids. Never deleted. MSA vet is character-bound in
    -- live ESO; we union every toon's list so one clear checks the account.
    CREATE TABLE IF NOT EXISTS character_completed_achievements (
      characterId  TEXT NOT NULL,
      id           INTEGER NOT NULL,
      PRIMARY KEY (characterId, id)
    );

    -- Player-authored labels (Tank / Healer / …). Not game data; keyed by
    -- character id so a snapshot re-import cannot wipe them.
    CREATE TABLE IF NOT EXISTS roles (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      color      TEXT NOT NULL,
      sortOrder  INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS character_roles (
      characterId  TEXT NOT NULL,
      roleId       TEXT NOT NULL,
      PRIMARY KEY (characterId, roleId),
      FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE
    );

    -- Player-authored planning targets. Not game data; keyed so a
    -- snapshot re-import cannot wipe them. scope: account = every live
    -- character; role/class/character narrow it (scopeKey = role id or
    -- class name). domain: skillline (rank target), ability, or script.
    CREATE TABLE IF NOT EXISTS goals (
      id          TEXT PRIMARY KEY,
      domain      TEXT NOT NULL DEFAULT 'skillline',
      tier        TEXT NOT NULL DEFAULT 'essential',
      scope       TEXT NOT NULL,
      characterId TEXT,
      scopeKey    TEXT,
      target      TEXT NOT NULL,
      targetRank  INTEGER NOT NULL DEFAULT 0,
      extraRank   INTEGER NOT NULL DEFAULT 0,
      note        TEXT NOT NULL DEFAULT '',
      createdAt   INTEGER NOT NULL
    );

    -- Player-authored gear builds. Not game data; a snapshot re-import
    -- must not wipe them. The json is the chosen sets and piece counts.
    CREATE TABLE IF NOT EXISTS gear_builds (
      id        TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      json      TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    );

    -- Player photos for a character or an owned house. Not game data;
    -- a snapshot re-import must not wipe them. Files live beside the db.
    CREATE TABLE IF NOT EXISTS gallery_photos (
      id         TEXT PRIMARY KEY,
      ownerKind  TEXT NOT NULL,
      ownerId    TEXT NOT NULL,
      ext        TEXT NOT NULL,
      bytes      INTEGER NOT NULL,
      createdAt  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_gallery_owner ON gallery_photos(ownerKind, ownerId, createdAt);

    -- The player's own profile picture and banner. Not game data;
    -- a snapshot re-import must not wipe them. Files live beside the db.
    CREATE TABLE IF NOT EXISTS profile_media (
      kind      TEXT PRIMARY KEY,
      ext       TEXT NOT NULL,
      bytes     INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);
  ensureCharacterSummaryColumns(db);
  ensureGameItemPlaceColumns(db);
  migrateCharacterRolesToMany(db);
  migrateGoalsTable(db);
  ensureGoalExtraRank(db);
  clampGoalRanks(db);
  deleteExcludedCatalogAndGoals(db);
  stripStoredVengeance(db);
}

/**
 * Small per-character fields the roster and every page header need, kept in
 * their own columns. Reading them out of the full character JSON made SQLite
 * re-parse every character's whole snapshot (about 1 MB each on an endgame
 * account) on every page. Older databases are filled in once, here.
 */
const SUMMARY_COLUMNS: [string, string][] = [
  ["archivedAt", "INTEGER"],
  ["gold", "INTEGER"],
  ["telVar", "INTEGER"],
  ["alliancePoints", "INTEGER"],
  ["classMastery", "INTEGER"],
  ["gender", "TEXT"],
  ["mundus", "TEXT"],
  ["lines", "TEXT"],
];

/** Where each item belongs (game/item-category.ts itemPlace), added after the index shipped. */
function ensureGameItemPlaceColumns(db: Database.Database) {
  const have = new Set((db.prepare("PRAGMA table_info(game_items)").all() as { name: string }[]).map((c) => c.name));
  for (const [name, type] of [
    ["category", "TEXT"],
    ["subtype", "TEXT"],
    ["typeLabel", "TEXT"],
    ["specializedLabel", "TEXT"],
    ["placeFrom", "TEXT"],
  ] as const) {
    if (!have.has(name)) db.exec(`ALTER TABLE game_items ADD COLUMN ${name} ${type}`);
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_game_items_category ON game_items(category, subtype)");
}

function ensureCharacterSummaryColumns(db: Database.Database) {
  const have = new Set((db.prepare("PRAGMA table_info(characters)").all() as { name: string }[]).map((c) => c.name));
  for (const [name, type] of SUMMARY_COLUMNS) {
    if (!have.has(name)) db.exec(`ALTER TABLE characters ADD COLUMN ${name} ${type}`);
  }
  try {
    db.exec(`
      UPDATE characters SET
        archivedAt = json_extract(json, '$.archivedAt'),
        gold = json_extract(json, '$.gold'),
        telVar = json_extract(json, '$.telVar'),
        alliancePoints = json_extract(json, '$.alliancePoints'),
        classMastery = json_extract(json, '$.classMastery'),
        gender = json_extract(json, '$.gender'),
        mundus = json_extract(json, '$.mundus'),
        lines = (
          SELECT json_group_array(json_object(
            'name', json_extract(line.value, '$.name'),
            'category', IFNULL(json_extract(line.value, '$.category'), ''),
            'rank', IFNULL(json_extract(line.value, '$.rank'), 0),
            'subclassed', IFNULL(json_extract(line.value, '$.subclassed'), 0)
          ))
          FROM json_each(COALESCE(json_extract(characters.json, '$.skillLines'), '[]')) AS line
        )
      WHERE lines IS NULL
    `);
  } catch {
    // SQLite without JSON1: the roster falls back to parsing the JSON itself.
  }
}

/** Older snapshots recorded Vengeance lines. Take them off the stored characters. */
function stripStoredVengeance(db: Database.Database) {
  const rows = db.prepare("SELECT id, json FROM characters").all() as { id: string; json: string }[];
  const update = db.prepare("UPDATE characters SET json = ? WHERE id = ?");
  for (const row of rows) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.json);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== "object") continue;
    const next = stripVengeanceFromCharacter(parsed as { skillLines?: { name?: string; category?: string }[]; classMasteries?: string[] });
    if (next === parsed) continue;
    update.run(JSON.stringify(next), row.id);
  }
}

/** Old DBs keyed assignments by character id only (one role). Keep existing rows. */
function migrateCharacterRolesToMany(db: Database.Database) {
  const cols = db.prepare("PRAGMA table_info(character_roles)").all() as { name: string; pk: number }[];
  if (cols.length === 0) return;
  const pk = cols
    .filter((c) => c.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((c) => c.name);
  if (pk.length === 2 && pk[0] === "characterId" && pk[1] === "roleId") return;

  db.exec(`
    CREATE TABLE character_roles_new (
      characterId  TEXT NOT NULL,
      roleId       TEXT NOT NULL,
      PRIMARY KEY (characterId, roleId),
      FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE
    );
    INSERT OR IGNORE INTO character_roles_new (characterId, roleId)
      SELECT characterId, roleId FROM character_roles;
    DROP TABLE character_roles;
    ALTER TABLE character_roles_new RENAME TO character_roles;
  `);
}

/**
 * Old DBs stored goals as skill-line rank targets only (lineName, two scopes).
 * Rebuild into the planner shape: same rows, domain=skillline, tier=essential.
 */
function migrateGoalsTable(db: Database.Database) {
  const cols = db.prepare("PRAGMA table_info(goals)").all() as { name: string }[];
  if (cols.length === 0) return;
  if (!cols.some((c) => c.name === "lineName")) return;

  db.exec(`
    CREATE TABLE goals_new (
      id          TEXT PRIMARY KEY,
      domain      TEXT NOT NULL DEFAULT 'skillline',
      tier        TEXT NOT NULL DEFAULT 'essential',
      scope       TEXT NOT NULL,
      characterId TEXT,
      scopeKey    TEXT,
      target      TEXT NOT NULL,
      targetRank  INTEGER NOT NULL DEFAULT 0,
      extraRank   INTEGER NOT NULL DEFAULT 0,
      note        TEXT NOT NULL DEFAULT '',
      createdAt   INTEGER NOT NULL
    );
    INSERT INTO goals_new (id, domain, tier, scope, characterId, scopeKey, target, targetRank, note, createdAt)
      SELECT id, 'skillline', 'essential',
             CASE WHEN scope = 'character' THEN 'character' ELSE 'account' END,
             characterId, NULL, lineName, targetRank, note, createdAt
      FROM goals;
    DROP TABLE goals;
    ALTER TABLE goals_new RENAME TO goals;
  `);
}

/** Planner-shaped databases from before extra ranks. */
function ensureGoalExtraRank(db: Database.Database) {
  const cols = db.prepare("PRAGMA table_info(goals)").all() as { name: string }[];
  if (cols.length === 0 || cols.some((c) => c.name === "extraRank")) return;
  db.exec("ALTER TABLE goals ADD COLUMN extraRank INTEGER NOT NULL DEFAULT 0");
}

/** A stored rank past the line's own cap can never be finished. Pull it back. */
function clampGoalRanks(db: Database.Database) {
  const cols = db.prepare("PRAGMA table_info(goals)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "extraRank") || !cols.some((c) => c.name === "target")) return;
  const rows = db
    .prepare(
      `SELECT id, target, targetRank, extraRank FROM goals WHERE domain = 'skillline' OR domain IS NULL`,
    )
    .all() as { id: string; target: string; targetRank: number; extraRank: number }[];
  const update = db.prepare("UPDATE goals SET targetRank = ?, extraRank = ? WHERE id = ?");
  for (const row of rows) {
    const cap = skillLineCap(row.target);
    if (cap == null) continue;
    const mandatory = Math.min(Math.max(0, row.targetRank), cap);
    let extra = Math.min(Math.max(0, row.extraRank ?? 0), cap);
    if (extra <= mandatory) extra = 0;
    if (mandatory === row.targetRank && extra === (row.extraRank ?? 0)) continue;
    if (mandatory === 0 && extra === 0) continue;
    update.run(mandatory, extra, row.id);
  }
}

export function getMeta<T = unknown>(key: string): T | null {
  const row = getDb().prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row ? (JSON.parse(row.value) as T) : null;
}

export function setMeta(key: string, value: unknown): void {
  getDb()
    .prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, JSON.stringify(value));
}

export const DB_FILE = DB_PATH;
