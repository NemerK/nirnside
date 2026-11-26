import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pruneRemovedFiles, pruneStale, readStaleList, shadowedAppEntries } from "./prune-stale.mjs";

function put(root, rel, body = "x") {
  const full = join(root, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body);
}

/** An install that a ZIP overlay moved Atlas into (atlas)/ on, without deleting the old pages. */
function brokenInstall() {
  const root = mkdtempSync(join(tmpdir(), "nirnside-prune-"));
  for (const rel of [
    "src/app/(atlas)/layout.tsx",
    "src/app/(atlas)/page.tsx",
    "src/app/(atlas)/inventory/page.tsx",
    "src/app/(atlas)/encyclopedia/sets/page.tsx",
    "src/app/(party)/party/layout.tsx",
    "src/app/api/health/route.ts",
    "src/app/globals.css",
    "src/app/icon.svg",
    // leftovers from before the move
    "src/app/layout.tsx",
    "src/app/page.tsx",
    "src/app/inventory/page.tsx",
    "src/app/encyclopedia/sets/page.tsx",
    "src/components/look-toggle.tsx",
    // the player's own data
    "data/nirnside.db",
    "data/incoming/NirnsideSnapshot.lua",
  ]) {
    put(root, rel);
  }
  return root;
}

test("finds top-level routes a route group now owns", () => {
  const root = brokenInstall();
  assert.deepEqual(shadowedAppEntries(root).sort(), ["src/app/encyclopedia", "src/app/inventory", "src/app/layout.tsx", "src/app/page.tsx"]);
});

test("removes leftovers and duplicate routes, keeps groups, API, shared files and data", () => {
  const root = brokenInstall();
  pruneStale(root, { paths: ["src/components/look-toggle.tsx", "data/nirnside.db", "../outside.txt"] });
  for (const gone of ["src/app/inventory", "src/app/encyclopedia", "src/app/layout.tsx", "src/app/page.tsx", "src/components/look-toggle.tsx"]) {
    assert.equal(existsSync(join(root, gone)), false, `${gone} should be gone`);
  }
  for (const kept of [
    "src/app/(atlas)/inventory/page.tsx",
    "src/app/(party)/party/layout.tsx",
    "src/app/api/health/route.ts",
    "src/app/globals.css",
    "src/app/icon.svg",
    "data/nirnside.db",
    "data/incoming/NirnsideSnapshot.lua",
  ]) {
    assert.equal(existsSync(join(root, kept)), true, `${kept} should stay`);
  }
});

test("does nothing on a clean install", () => {
  const root = mkdtempSync(join(tmpdir(), "nirnside-prune-"));
  put(root, "src/app/(atlas)/inventory/page.tsx");
  put(root, "src/app/api/health/route.ts");
  assert.deepEqual(pruneStale(root, { paths: [] }), []);
});

test("after an overlay, drops app files the new version no longer has, never data", () => {
  const from = mkdtempSync(join(tmpdir(), "nirnside-new-"));
  const to = mkdtempSync(join(tmpdir(), "nirnside-old-"));
  put(from, "src/app/(atlas)/inventory/page.tsx");
  put(from, "scripts/self-update.mjs");
  put(to, "src/app/(atlas)/inventory/page.tsx");
  put(to, "src/app/inventory/page.tsx");
  put(to, "scripts/self-update.mjs");
  put(to, "data/nirnside.db");
  put(to, "node_modules/x/index.js");
  const removed = pruneRemovedFiles(from, to, (rel) => rel.replace(/\\/g, "/").startsWith("node_modules"));
  assert.deepEqual(removed, ["src/app/inventory/page.tsx"]);
  assert.equal(existsSync(join(to, "src/app/inventory")), false, "empty folder removed too");
  assert.equal(existsSync(join(to, "data/nirnside.db")), true);
  assert.equal(existsSync(join(to, "node_modules/x/index.js")), true);
});

test("the shipped leftover list only names app code", () => {
  const list = readStaleList();
  assert.ok(list.length > 0);
  for (const p of list) assert.match(p, /^(src|scripts|public|addon)\//);
});
