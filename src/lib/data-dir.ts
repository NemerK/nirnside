import { dirname, join, resolve } from "node:path";

/**
 * Where this player's own data lives: the database and, next to it, profile
 * pictures, gallery photos, dropped SavedVariables files and the icon cache.
 *
 * Source checkouts keep it in ./data. The Windows app runs a ready-built copy
 * from its own folder and points NIRNSIDE_DB at <install>/data/nirnside.db, so
 * an update can replace the app folder without ever touching player data.
 */
export function dbFile(): string {
  return resolve(/* turbopackIgnore: true */ process.env.NIRNSIDE_DB ?? "./data/nirnside.db");
}

export function dataDir(): string {
  return dirname(dbFile());
}

/** Downloaded game icons. Kept with player data when NIRNSIDE_DB moves it. */
export function iconCacheDir(): string {
  if (process.env.NIRNSIDE_DB) return join(/* turbopackIgnore: true */ dataDir(), "cache", "icons");
  return join(/* turbopackIgnore: true */ process.cwd(), ".cache", "icons");
}
