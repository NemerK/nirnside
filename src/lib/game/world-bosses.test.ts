import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WORLD_BOSS_DAILIES, WORLD_BOSS_ZONES, worldBossZoneForQuestId } from "./world-bosses";

describe("world-boss dailies", () => {
  it("maps WPamA quest ids onto the live DLC zones", () => {
    assert.equal(worldBossZoneForQuestId(5522), "wrothgar");
    assert.equal(worldBossZoneForQuestId(5605), "gold-coast");
    assert.equal(worldBossZoneForQuestId(7270), "solstice");
    assert.equal(worldBossZoneForQuestId(1), null);
  });

  it("has one row per WPamA world-boss daily", () => {
    assert.equal(WORLD_BOSS_DAILIES.length, 62);
    assert.equal(WORLD_BOSS_ZONES.length, 13);
    assert.equal(new Set(WORLD_BOSS_DAILIES.map((row) => row.questId)).size, 62);
  });
});
