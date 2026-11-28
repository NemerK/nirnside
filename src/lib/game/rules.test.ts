import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readRules, resetHourFromGame, REFERENCE_RULES } from "./rules";
import { dailyResetHourUtc, esoDayKey, nextEsoResetAt, resetLabel } from "./daily-reset";
import { skillLineCap } from "./skill-caps";
import { championState } from "./champion";
import { groupChampionStars } from "./champion-bar";
import { readCompanion } from "./companions";

describe("the game's rules come first", () => {
  it("uses the game's numbers and says so", () => {
    const r = readRules({
      maxLevel: 50,
      championCap: 3700,
      championPerConstellation: 1300,
      championSlots: [
        { disciplineId: 1, name: "Craft", slots: 4 },
        { disciplineId: 2, name: "Warfare", slots: 5 },
        { disciplineId: 3, name: "Fitness", slots: 4 },
      ],
      maxAbilityRank: 4,
      skyshardsPerPoint: 3,
      companionMaxLevel: 25,
      retraitCost: 40,
      dailyResetAt: 1_795_921_200,
      currencyCaps: { transmuteCrystals: 1000 },
    });
    assert.equal(r.championCap, 3700);
    assert.equal(r.championSlots.Warfare, 5);
    assert.equal(r.companionMaxLevel, 25);
    assert.equal(r.retraitCost, 40);
    assert.equal(r.currencyCaps.transmuteCrystals, 1000);
    assert.equal(r.source.championCap, "game");
    assert.equal(r.source.championSlots, "game");
    assert.equal(r.source.dailyResetAt, "game");
  });

  it("falls back to the reference, field by field, and says that too", () => {
    const r = readRules({ championCap: 3600, retraitCost: null });
    assert.equal(r.source.championCap, "game");
    assert.equal(r.retraitCost, REFERENCE_RULES.retraitCost);
    assert.equal(r.source.retraitCost, "reference");
    const none = readRules(null);
    assert.equal(none.maxLevel, REFERENCE_RULES.maxLevel);
    assert.equal(none.source.championSlots, "reference");
    assert.equal(none.dailyResetAt, null);
  });
});

describe("the reset clock", () => {
  // 2026-11-29 03:00 UTC, as the game would report the next daily reset.
  const gameReset = Date.UTC(2026, 10, 29, 3, 0, 0) / 1000;

  it("takes the hour from the game's reset time", () => {
    assert.equal(resetHourFromGame(gameReset), 3);
    assert.equal(resetHourFromGame(null), null);
    const clock = { region: "NA" as const, gameHourUtc: 3 };
    assert.equal(dailyResetHourUtc(clock), 3);
    assert.equal(resetLabel(clock), "NA 03:00 UTC");
  });

  it("uses the megaserver's reference hour until the game reports one", () => {
    assert.equal(dailyResetHourUtc({ region: "NA", gameHourUtc: null }), 10);
    assert.equal(dailyResetHourUtc("EU"), 3);
    const now = Date.UTC(2026, 10, 28, 12, 0, 0) / 1000;
    assert.equal(nextEsoResetAt(now, { region: "EU", gameHourUtc: 3 }), gameReset);
    assert.equal(esoDayKey(now, { region: "EU", gameHourUtc: 3 }), "2026-11-28");
  });
});

describe("caps and counts from the game", () => {
  it("prefers a skill line's cap the game reported", () => {
    assert.equal(skillLineCap("Assault", new Map([["assault", 12]])), 12);
    assert.equal(skillLineCap("Assault"), 10);
    assert.equal(skillLineCap("Class Mastery", new Map([["class mastery", 9]])), null);
  });

  it("counts Champion points and slots the game's way", () => {
    const [craft] = championState(
      [{ name: "Craft", stars: [{ name: "Steed's Blessing", points: 50, slotted: true }], spent: 120, unspent: 7 }],
      { Craft: 5, Warfare: 4, Fitness: 4 },
    );
    assert.equal(craft.spent, 120);
    assert.equal(craft.unspent, 7);
    assert.equal(craft.freeSlots, 4);
    const old = championState([{ name: "Craft", stars: [{ name: "Steed's Blessing", points: 50, slotted: true }] }]);
    assert.equal(old[0].spent, 50);
    assert.equal(old[0].unspent, null);
    assert.equal(groupChampionStars([], new Map(), 5).equipped.length, 5);
  });

  it("caps a companion at the game's level", () => {
    assert.equal(readCompanion({ name: "Isobel Veloise", level: 20 }, 25).maxed, false);
    assert.equal(readCompanion({ name: "Isobel Veloise", level: 20 }).maxed, true);
  });
});
