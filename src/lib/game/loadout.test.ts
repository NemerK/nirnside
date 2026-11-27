import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { activeBonuses, loadoutOf, perfectedCountOnBar, setCountOnBar } from "./loadout";

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

  it("wears perfected and normal pieces as one set; the perfected line needs perfected pieces", () => {
    const body = ["Head", "Chest", "Legs", "Feet"].map((slot, i) => ({
      slot,
      type: `Heavy ${slot}`,
      setName: "Perfected Slivers of the Null Arca",
      setId: 900 + i * 0,
    }));
    const l = loadoutOf([...body, { slot: "Hands", type: "Heavy Hands", setName: "Slivers of the Null Arca", setId: 800 }]);
    assert.equal(l.sets.length, 1);
    assert.equal(l.sets[0].name, "Slivers of the Null Arca");
    assert.equal(l.sets[0].setId, 800);
    assert.equal(setCountOnBar(l, "Perfected Slivers of the Null Arca", "front"), 5);
    assert.equal(perfectedCountOnBar(l, "Slivers of the Null Arca", "front"), 4);
    const bonuses = [
      { pieces: 2, text: "a" },
      { pieces: 5, text: "b" },
      { pieces: 5, text: "perfected", perfected: true },
    ];
    assert.deepEqual(activeBonuses(bonuses, 5, 4).map((b) => b.text), ["a", "b"]);
    assert.deepEqual(activeBonuses(bonuses, 5, 5).map((b) => b.text), ["a", "b", "perfected"]);
  });

  it("keeps the game's own count when the scan reports it", () => {
    const g = loadoutOf([{ slot: "Head", type: "Heavy Head", setName: "X", setCount: 3, setPerfectedCount: 1 }]);
    assert.equal(g.sets[0].gameCount, 3);
    assert.equal(g.sets[0].gamePerfectedCount, 1);
  });
});
