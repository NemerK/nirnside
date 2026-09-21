import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadSnapshotFromFile, loadSnapshotFromLua } from "../snapshot/load";
import {
  PITHKA_ARENAS,
  allPithkaAchievementIds,
  coerceCompletedAchievementIds,
  collectCompletedAchievementIdsFromSnapshot,
  unionCompletedAchievementIds,
} from "./pithka";

describe("Pithka arenas", () => {
  it("tracks Maelstrom vet and Flawless Conqueror (Perfect Run)", () => {
    const msa = PITHKA_ARENAS.find((r) => r.abbv === "MSA");
    assert.equal(msa?.vet, 1305);
    assert.equal(msa?.tri, 1330);
    assert.equal(msa?.triName, "Flawless Conqueror");
  });

  it("sample snapshot includes both Maelstrom checks", () => {
    const snap = loadSnapshotFromFile(resolve("data/sample/Nirnside.lua"));
    const done = new Set(snap.completedAchievementIds);
    assert.equal(done.has(1305), true);
    assert.equal(done.has(1330), true);
  });

  it("accepts SavedVariables that store completed ids as a set map", () => {
    const snap = loadSnapshotFromLua(`
      NirnsideData = {
        ["Default"] = {
          ["@Test"] = {
            ["$AccountWide"] = {
              displayName = "@Test",
              completedAchievementIds = { [1305] = true, [1140] = true },
            },
          },
        },
      }
    `);
    assert.deepEqual(snap.completedAchievementIds, [1140, 1305]);
  });
});

describe("coerceCompletedAchievementIds", () => {
  it("reads a dense list", () => {
    assert.deepEqual(coerceCompletedAchievementIds([1140, 1305]), [1140, 1305]);
  });

  it("reads an id-keyed map the way SavedVariables sometimes writes sets", () => {
    assert.deepEqual(coerceCompletedAchievementIds({ 1305: true, 1140: true }), [1140, 1305]);
    assert.deepEqual(coerceCompletedAchievementIds({ 1: 1305, 2: 1140 }), [1140, 1305]);
  });

  it("treats missing data as empty, not as a wipe", () => {
    assert.deepEqual(coerceCompletedAchievementIds(undefined), []);
    assert.deepEqual(coerceCompletedAchievementIds({}), []);
  });
});

describe("unionCompletedAchievementIds", () => {
  it("keeps previously known completions when a later snapshot omits them", () => {
    assert.deepEqual(unionCompletedAchievementIds([1305, 1140], [1140, 2363]), [1140, 1305, 2363]);
  });

  it("accepts a first snapshot with nothing stored yet", () => {
    assert.deepEqual(unionCompletedAchievementIds(undefined, [1305]), [1305]);
    assert.deepEqual(unionCompletedAchievementIds([1305], undefined), [1305]);
  });
});

describe("collectCompletedAchievementIdsFromSnapshot", () => {
  it("unions an account list, per-character lists, and completed records", () => {
    assert.deepEqual(
      collectCompletedAchievementIdsFromSnapshot({
        completedAchievementIds: [1140],
        characterCompletedIds: { "char-msa": [1305], "char-alt": [2363] },
        achievementRecords: [
          { id: 1330, completed: true },
          { id: 9999, completed: false },
        ],
      }),
      [1140, 1305, 1330, 2363],
    );
  });

  it("keeps MSA vet stored on another character when the account list omitted it", () => {
    const snap = loadSnapshotFromLua(`
      NirnsideData = {
        ["Default"] = {
          ["@Test"] = {
            ["$AccountWide"] = {
              displayName = "@Test",
              completedAchievementIds = { 1140 },
              characterCompletedIds = { ["char-msa"] = { [1305] = true, [1330] = true } },
            },
          },
        },
      }
    `);
    assert.equal(snap.completedAchievementIds.includes(1305), false);
    assert.deepEqual(snap.characterCompletedIds["char-msa"], [1305, 1330]);
    const done = collectCompletedAchievementIdsFromSnapshot(snap);
    assert.equal(done.includes(1305), true);
    assert.equal(done.includes(1330), true);
    assert.equal(done.includes(1140), true);
  });
});

describe("addon tracked ids", () => {
  it("lists every Pithka id so IsAchievementComplete is queried directly", () => {
    const lua = readFileSync(resolve("addon/NirnsideSnapshot/NirnsideSnapshot.lua"), "utf8");
    const block = lua.match(/local TRACKED_ACHIEVEMENT_IDS = \{([\s\S]*?)\n\}/);
    assert.ok(block, "TRACKED_ACHIEVEMENT_IDS table is missing");
    const luaIds = [...block[1].matchAll(/\d+/g)].map((m) => Number(m[0])).sort((a, b) => a - b);
    assert.deepEqual(luaIds, allPithkaAchievementIds());
  });

  it("unions per-character completions so MSA vet survives an alt logout", () => {
    const lua = readFileSync(resolve("addon/NirnsideSnapshot/NirnsideSnapshot.lua"), "utf8");
    assert.match(lua, /characterCompletedIds/);
    assert.match(lua, /gatherCompletedAchievementIds\(charId, achRecords\)/);
    assert.match(lua, /pairs\(sv\.characterCompletedIds\)/);
    assert.match(lua, /collectIdsFromTable\(sv\.characterCompletedIds\[charId\]/);
    assert.match(lua, /Never shrink this toon's list/);
  });
});
