/**
 * Background watcher. Watches the ESO SavedVariables file for Nirnside and
 * re-imports it whenever the game rewrites it (on logout / ReloadUI). This is
 * the "work-free" path: leave it running and the app stays current.
 *
 *   npm run watch                  # watches the bundled sample fixture
 *   npm run watch -- /path/Nirnside.lua
 *   NIRNSIDE_SV_FILE=... npm run watch
 *
 * The watcher does nothing to the game; it only reads a file the game writes.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { watch } from "chokidar";
import { loadSnapshotFromFile } from "../src/lib/snapshot/load";
import { importSnapshot } from "../src/lib/db/import";

const SAMPLE = resolve("data/sample/Nirnside.lua");
const file = resolve(process.argv[2] ?? process.env.NIRNSIDE_SV_FILE ?? SAMPLE);

let timer: NodeJS.Timeout | null = null;

function runImport(reason: string) {
  // Debounce: the game can touch the file a few times as it flushes.
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      const snap = loadSnapshotFromFile(file);
      const result = importSnapshot(snap);
      const when = new Date().toLocaleTimeString();
      console.log(
        `[${when}] (${reason}) imported ${snap.displayName} — ` +
          `${result.characters} chars, ${result.items} items, ${result.sets} sets`,
      );
    } catch (err) {
      console.error(`[watch] import failed: ${err instanceof Error ? err.message : err}`);
    }
  }, 600);
}

if (!existsSync(file)) {
  console.error(`Watch target does not exist yet: ${file}`);
  console.error("It will be picked up once the game (or you) creates it.");
}

console.log(`Nirnside watcher running. Watching:\n  ${file}\nPress Ctrl+C to stop.`);
if (existsSync(file)) runImport("initial");

watch(file, { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 } })
  .on("add", () => runImport("add"))
  .on("change", () => runImport("change"));
