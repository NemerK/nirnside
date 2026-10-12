import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WORLD_BOSS_DAILIES } from "./world-bosses";
import { ZONE_DAILY_QUESTS, ZONE_DAILY_ZONES, zoneDailyForQuestId } from "./zone-dailies";

describe("zone dailies", () => {
  it("gives every zone a delve and a world boss, and a third slot only when it has an event", () => {
    assert.equal(ZONE_DAILY_ZONES.length, 18);
    for (const zone of ZONE_DAILY_ZONES) {
      assert.equal(zone.slots[0]?.kind, "delve");
      assert.equal(zone.slots[1]?.kind, "boss");
      assert.ok(zone.slots.length === 2 || zone.slots.length === 3);
    }
    assert.equal(ZONE_DAILY_ZONES.find((z) => z.id === "wrothgar")?.slots.length, 2);
    assert.equal(ZONE_DAILY_ZONES.find((z) => z.id === "summerset")?.slots.length, 3);
    assert.equal(ZONE_DAILY_ZONES.find((z) => z.id === "necrom")?.slots.find((s) => s.kind === "event")?.label, "Bastion");
  });

  it("keeps quest ids unique and includes every WPamA world boss", () => {
    const ids = ZONE_DAILY_QUESTS.map((row) => row.questId);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.length, 211);
    for (const boss of WORLD_BOSS_DAILIES) {
      const row = zoneDailyForQuestId(boss.questId);
      assert.ok(row, `missing world boss ${boss.questId}`);
      assert.equal(row?.kind, "boss");
    }
  });

  it("maps the live slots, including the corrected Solstice delve id", () => {
    assert.equal(zoneDailyForQuestId(5522)?.zone, "wrothgar");
    assert.equal(zoneDailyForQuestId(5522)?.kind, "boss");
    assert.equal(zoneDailyForQuestId(6166)?.kind, "event");
    assert.equal(zoneDailyForQuestId(6166)?.zone, "summerset");
    assert.equal(zoneDailyForQuestId(7268)?.name, "Black Worm Relics");
    assert.equal(zoneDailyForQuestId(7269)?.name, "Fragments of Fear");
    assert.equal(zoneDailyForQuestId(7269)?.kind, "delve");
    assert.equal(zoneDailyForQuestId(6527)?.zone, "western-skyrim");
    assert.equal(zoneDailyForQuestId(1), null);
  });

  it("does not change the snapshot addon that writes the account file", () => {
    const lua = readFileSync("addon/NirnsideSnapshot/NirnsideSnapshot.lua", "utf8");
    const txt = readFileSync("addon/NirnsideSnapshot/NirnsideSnapshot.txt", "utf8");
    assert.match(lua, /local WORLD_BOSS_BY_ID = \{/);
    assert.doesNotMatch(lua, /ZONE_DAILY_BY_ID/);
    assert.doesNotMatch(lua, /zoneDailies/);
    assert.match(txt, /## Version: 0\.9\.30/);
    assert.match(txt, /## AddOnVersion: 32/);
  });
});
