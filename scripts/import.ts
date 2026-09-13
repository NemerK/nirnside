/**
 * One-shot importer: read a Nirnside SavedVariables file and load it into the
 * local SQLite DB.
 *
 *   npm run import                 # imports the bundled sample fixture
 *   npm run import -- /path/Nirnside.lua
 *   NIRNSIDE_SV_FILE=... npm run import
 *
 * On a real PC the file lives at:
 *   Documents/Elder Scrolls Online/liveeu/SavedVariables/Nirnside.lua   (EU)
 *   Documents/Elder Scrolls Online/live/SavedVariables/Nirnside.lua     (NA)
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadSnapshotFromFile } from "../src/lib/snapshot/load";
import { importSnapshot } from "../src/lib/db/import";

const SAMPLE = resolve("data/sample/Nirnside.lua");

function resolveSource(): string {
  const arg = process.argv[2];
  const fromEnv = process.env.NIRNSIDE_SV_FILE;
  const candidate = arg ?? fromEnv ?? SAMPLE;
  if (!existsSync(candidate)) {
    console.error(`SavedVariables file not found: ${candidate}`);
    console.error("Pass a path, set NIRNSIDE_SV_FILE, or omit to use the sample fixture.");
    process.exit(1);
  }
  return candidate;
}

function main() {
  const file = resolveSource();
  console.log(`Importing snapshot from ${file}`);
  try {
    const snap = loadSnapshotFromFile(file);
    const result = importSnapshot(snap);
    console.log(
      `Imported ${snap.displayName} (${snap.region}) — ` +
        `${result.characters} characters, ${result.items} items, ${result.sets} stickerbook sets.`,
    );
  } catch (err) {
    console.error("Import failed:");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
