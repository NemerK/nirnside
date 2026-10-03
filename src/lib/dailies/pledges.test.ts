import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dungeonFromPledgeQuestName, pledgeGiverForDungeon } from "./pledges";

describe("pledge giver map", () => {
  it("puts the original 16 on Maj", () => {
    assert.equal(pledgeGiverForDungeon("Fungal Grotto I"), "maj");
    assert.equal(pledgeGiverForDungeon("City of Ash II"), "maj");
    assert.equal(pledgeGiverForDungeon("Pledge: Banished Cells I"), "maj");
  });

  it("puts ICP through Unhallowed Grave on Glirion", () => {
    assert.equal(pledgeGiverForDungeon("Imperial City Prison"), "glirion");
    assert.equal(pledgeGiverForDungeon("White-Gold Tower"), "glirion");
    assert.equal(pledgeGiverForDungeon("White Gold Tower"), "glirion");
    assert.equal(pledgeGiverForDungeon("Icereach"), "glirion");
    assert.equal(pledgeGiverForDungeon("Unhallowed Grave"), "glirion");
  });

  it("puts Stone Garden onward on Urgarlag", () => {
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
});
