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
