import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  communityPledgesForDayKey,
  dungeonFromPledgeQuestName,
  pledgeByQuestId,
  PLEDGE_QUESTS,
  pledgeGiverForDungeon,
  sameDungeon,
} from "./pledges";

describe("pledge giver map", () => {
  it("puts the original 12 easier dungeons on Maj", () => {
    assert.equal(pledgeGiverForDungeon("Fungal Grotto I"), "maj");
    assert.equal(pledgeGiverForDungeon("Pledge: Banished Cells I"), "maj");
    assert.equal(pledgeGiverForDungeon("Spindleclutch II"), "maj");
    assert.equal(pledgeGiverForDungeon("Wayrest Sewers II"), "maj");
  });

  it("puts City of Ash and Crypt of Hearts on Glirion", () => {
    assert.equal(pledgeGiverForDungeon("City of Ash II"), "glirion");
    assert.equal(pledgeGiverForDungeon("Crypt of Hearts I"), "glirion");
    assert.equal(pledgeGiverForDungeon("Direfrost Keep"), "glirion");
    assert.equal(pledgeGiverForDungeon("Arx Corinium"), "glirion");
  });

  it("puts Imperial City Prison onward on Urgarlag", () => {
    assert.equal(pledgeGiverForDungeon("Imperial City Prison"), "urgarlag");
    assert.equal(pledgeGiverForDungeon("White-Gold Tower"), "urgarlag");
    assert.equal(pledgeGiverForDungeon("White Gold Tower"), "urgarlag");
    assert.equal(pledgeGiverForDungeon("Icereach"), "urgarlag");
    assert.equal(pledgeGiverForDungeon("Unhallowed Grave"), "urgarlag");
    assert.equal(pledgeGiverForDungeon("Stone Garden"), "urgarlag");
    assert.equal(pledgeGiverForDungeon("The Cauldron"), "urgarlag");
    assert.equal(pledgeGiverForDungeon("Black Gem Foundry"), "urgarlag");
  });

  it("strips the Pledge: prefix from journal names", () => {
    assert.equal(dungeonFromPledgeQuestName("Pledge: Fungal Grotto I"), "Fungal Grotto I");
  });

  it("does not invent a giver for an unknown dungeon", () => {
    assert.equal(pledgeGiverForDungeon("Hel Ra Citadel"), null);
  });

  it("maps WPamA pledge quest ids to the live NPC split", () => {
    assert.equal(pledgeByQuestId(5247)?.giver, "maj");
    assert.equal(pledgeByQuestId(5381)?.giver, "glirion");
    assert.equal(pledgeByQuestId(5381)?.dungeon, "City of Ash II");
    assert.equal(pledgeByQuestId(6415)?.giver, "urgarlag");
    assert.equal(pledgeByQuestId(6415)?.dungeon, "Icereach");
    assert.equal(PLEDGE_QUESTS.filter((row) => row.giver === "maj").length, 12);
    assert.equal(PLEDGE_QUESTS.filter((row) => row.giver === "glirion").length, 12);
  });
});

describe("community pledge rotation", () => {
  it("matches the 2026-10-03 ESO-Hub / UESP check", () => {
    const today = communityPledgesForDayKey("2026-10-03");
    assert.equal(today.maj, "Banished Cells II");
    assert.equal(today.glirion, "City of Ash II");
    assert.equal(today.urgarlag, "Shipwright's Regret");
  });

  it("advances one dungeon per ESO day", () => {
    const next = communityPledgesForDayKey("2026-10-04");
    assert.equal(next.maj, "Darkshade Caverns I");
    assert.equal(next.glirion, "Crypt of Hearts I");
    assert.equal(next.urgarlag, "Earthen Root Enclave");
  });

  it("treats The Banished Cells II as today's Maj", () => {
    assert.equal(sameDungeon("The Banished Cells II", "Banished Cells II"), true);
    assert.equal(sameDungeon("Fungal Grotto I", "Banished Cells II"), false);
  });
});
