import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { overlayCopy, shouldSkip } from "./self-update.mjs";

describe("self-update overlay", () => {
  it("skips account data and incoming lua", () => {
    assert.equal(shouldSkip("data/nirnside.db"), true);
    assert.equal(shouldSkip("data/nirnside.db-wal"), true);
    assert.equal(shouldSkip("data/incoming/NirnsideSnapshot.lua"), true);
    assert.equal(shouldSkip("data/catalog/sets.json"), false);
    assert.equal(shouldSkip("addon/NirnsideSnapshot/NirnsideSnapshot.lua"), false);
    assert.equal(shouldSkip("node_modules/next/index.js"), true);
  });

  it("copies app files but keeps the local database", () => {
    const from = join(tmpdir(), `nirnside-from-${Date.now()}`);
    const to = join(tmpdir(), `nirnside-to-${Date.now()}`);
    mkdirSync(join(from, "src"), { recursive: true });
    mkdirSync(join(from, "data", "catalog"), { recursive: true });
    mkdirSync(join(from, "data", "incoming"), { recursive: true });
    mkdirSync(join(to, "data", "incoming"), { recursive: true });
    writeFileSync(join(from, "src", "app.txt"), "new");
    writeFileSync(join(from, "data", "catalog", "sets.json"), "[]");
    writeFileSync(join(from, "data", "incoming", "NirnsideSnapshot.lua"), "-- upstream lua must not land");
    writeFileSync(join(to, "data", "nirnside.db"), "MY-ACCOUNT");
    writeFileSync(join(to, "data", "incoming", "NirnsideSnapshot.lua"), "-- mine");

    overlayCopy(from, to);

    assert.equal(readFileSync(join(to, "src", "app.txt"), "utf8"), "new");
    assert.equal(readFileSync(join(to, "data", "catalog", "sets.json"), "utf8"), "[]");
    assert.equal(readFileSync(join(to, "data", "nirnside.db"), "utf8"), "MY-ACCOUNT");
    assert.equal(readFileSync(join(to, "data", "incoming", "NirnsideSnapshot.lua"), "utf8"), "-- mine");
    assert.equal(existsSync(join(to, "data", "incoming", "NirnsideSnapshot.lua")), true);

    rmSync(from, { recursive: true, force: true });
    rmSync(to, { recursive: true, force: true });
  });
});
