#!/usr/bin/env node
/**
 * Confirm the bundled better-sqlite3 binary loads. First-run Windows installs
 * must never require Visual Studio — the package already includes a .node file.
 */
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));
const pkgDir = join(root, "node_modules", "better-sqlite3");
const prebuildDir = join(pkgDir, "prebuilds");

function prebuildNames() {
  if (!existsSync(prebuildDir)) return [];
  try {
    return readdirSync(prebuildDir);
  } catch {
    return [];
  }
}

try {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.exec("SELECT 1");
  db.close();
} catch (err) {
  const names = prebuildNames();
  console.error("Nirnside could not load its local database engine.");
  console.error(err instanceof Error ? err.message : String(err));
  console.error("");
  if (names.length) {
    console.error("A prebuilt SQLite binary is already on disk:");
    for (const n of names) console.error("  " + n);
    console.error("Visual Studio, Python, and node-gyp are not required.");
  } else if (existsSync(pkgDir)) {
    console.error("better-sqlite3 is installed but has no prebuilds/ folder.");
  } else {
    console.error("better-sqlite3 is not installed. npm install did not finish.");
  }
  console.error("Install Node.js LTS (green button) from https://nodejs.org and try again.");
  process.exit(1);
}
