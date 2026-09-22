import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Local SQLite database. Lives on the user's own disk only (see the privacy
 * rule). Default location is ./data/nirnside.db; override with NIRNSIDE_DB.
 */
const DB_PATH = resolve(/* turbopackIgnore: true */ process.env.NIRNSIDE_DB ?? "./data/nirnside.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
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

    -- Player-authored skill-line rank targets. Not game data; keyed so a
    -- snapshot re-import cannot wipe them. scope=account applies to every
    -- live character; scope=character is one toon.
    CREATE TABLE IF NOT EXISTS goals (
      id            TEXT PRIMARY KEY,
      scope         TEXT NOT NULL,
      characterId   TEXT,
      lineName      TEXT NOT NULL,
      targetRank    INTEGER NOT NULL,
      note          TEXT NOT NULL DEFAULT '',
      createdAt     INTEGER NOT NULL
    );
  `);
  migrateCharacterRolesToMany(db);
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
