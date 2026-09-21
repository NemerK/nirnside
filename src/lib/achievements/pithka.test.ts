import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadSnapshotFromFile } from "../snapshot/load";
import {
  PITHKA_ARENAS,
  allPithkaAchievementIds,
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

describe("addon tracked ids", () => {
  it("lists every Pithka id so IsAchievementComplete is queried directly", () => {
    const lua = readFileSync(resolve("addon/NirnsideSnapshot/NirnsideSnapshot.lua"), "utf8");
    const block = lua.match(/local TRACKED_ACHIEVEMENT_IDS = \{([\s\S]*?)\n\}/);
    assert.ok(block, "TRACKED_ACHIEVEMENT_IDS table is missing");
    const luaIds = [...block[1].matchAll(/\d+/g)].map((m) => Number(m[0])).sort((a, b) => a - b);
    assert.deepEqual(luaIds, allPithkaAchievementIds());
  });
});
