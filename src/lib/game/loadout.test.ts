import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { activeBonuses, loadoutOf, setCountOnBar } from "./loadout";

const body = (slot: string, type: string, setName: string) => ({ slot, type, setName });

describe("loadout", () => {
  const gear = loadoutOf([
    body("Head", "Heavy Head", "Monster"),
    body("Shoulders", "Heavy Shoulders", "Monster"),
    body("Chest", "Light Chest", "Lancer"),
    body("Hands", "Light Hands", "Lancer"),
    body("Waist", "Light Waist", "Lancer"),
    body("Legs", "Medium Legs", "Lancer"),
    body("Feet", "Light Feet", "Torment"),
    body("Neck", "Necklace", "Torment"),
    body("Ring 1", "Ring", "Torment"),
    body("Ring 2", "Ring", "Torment"),
    { slot: "Main Hand", bar: "front" as const, type: "Inferno Staff", setName: "Lancer" },
    { slot: "Main Hand", bar: "back" as const, type: "Dagger", setName: "Torment" },
    { slot: "Off Hand", bar: "back" as const, type: "Dagger", setName: "Torment" },
  ]);

  it("counts body armor by weight, not jewelry or weapons", () => {
    assert.deepEqual(gear.armorWeights, { light: 4, medium: 1, heavy: 2 });
  });

  it("counts a two-hander as two and weapons only on their bar", () => {
    assert.equal(setCountOnBar(gear, "Lancer", "front"), 6);
    assert.equal(setCountOnBar(gear, "Lancer", "back"), 4);
    assert.equal(setCountOnBar(gear, "Torment", "front"), 4);
    assert.equal(setCountOnBar(gear, "Torment", "back"), 6);
    assert.equal(setCountOnBar(gear, "Monster", "back"), 2);
  });

  it("grants every bonus up to the worn count", () => {
    const bonuses = [{ pieces: 2 }, { pieces: 3 }, { pieces: 4 }, { pieces: 5 }];
    assert.deepEqual(activeBonuses(bonuses, 4).map((b) => b.pieces), [2, 3, 4]);
  });

  it("keeps the game's own count when the scan reports it", () => {
    const g = loadoutOf([{ slot: "Head", type: "Heavy Head", setName: "X", setCount: 3, setPerfectedCount: 1 }]);
    assert.equal(g.sets[0].gameCount, 3);
    assert.equal(g.sets[0].gamePerfectedCount, 1);
  });
});
