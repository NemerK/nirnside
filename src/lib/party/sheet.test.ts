import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { presentGear, presentLines } from "./sheet";

function eq(slot: string, setName: string | null, bar: "front" | "back" | null = null) {
  return { slot, bar, name: `${setName ?? "Plain"} ${slot}`, setName, trait: null, enchant: null, scribing: [] };
}

describe("presentGear", () => {
  const gear = presentGear([
    eq("Head", "Slimecraw"),
    eq("Shoulders", "Slimecraw"),
    eq("Chest", "Coral Riptide"),
    eq("Main Hand", "Coral Riptide", "front"),
    eq("Off Hand", "Coral Riptide", "front"),
    eq("Main Hand", "Sul-Xan's Torment", "back"),
  ]);

  it("splits body, front bar and back bar", () => {
    assert.equal(gear.body.length, 3);
    assert.equal(gear.front.length, 2);
    assert.equal(gear.back.length, 1);
  });

  it("counts sets with the front bar out, then what changes on the back bar", () => {
    assert.deepEqual(gear.frontSets, [
      { name: "Coral Riptide", count: 3 },
      { name: "Slimecraw", count: 2 },
    ]);
    assert.deepEqual(gear.backSets, [
      { name: "Coral Riptide", count: 1 },
      { name: "Sul-Xan's Torment", count: 1 },
    ]);
  });

  it("treats weapon slots without a bar as front bar", () => {
    const g = presentGear([eq("Main Hand", "Deadly Strike")]);
    assert.equal(g.front.length, 1);
  });
});

describe("presentLines", () => {
  it("puts class lines first, own class before subclassed, and leaves out Class Mastery", () => {
    const lines = presentLines([
      { name: "Dual Wield", category: "Weapon", rank: 50, subclassed: false, classMastery: false, abilities: [] },
      { name: "Herald of the Tome", category: "Class", rank: 38, subclassed: true, classMastery: false, abilities: [] },
      { name: "Assassination", category: "Class", rank: 50, subclassed: false, classMastery: false, abilities: [] },
      { name: "Class Mastery", category: "Class", rank: 1, subclassed: false, classMastery: true, abilities: [] },
    ]);
    assert.deepEqual(
      lines.map((l) => l.name),
      ["Assassination", "Herald of the Tome", "Dual Wield"],
    );
  });
});
