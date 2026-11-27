import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Character } from "../snapshot/schema";
import { classLineMap } from "./classes";
import { readCharacter } from "./understand";

describe("reading a character through every system", () => {
  it("connects race, class, gear, CP and research", () => {
    const c = Character.parse({
      id: "c1",
      name: "Asadel",
      class: "Templar",
      race: "Redguard",
      alliance: "Aldmeri Dominion",
      skillLines: [
        { name: "Aedric Spear", category: "Class", rank: 50, ownClass: true, active: true },
        { name: "Dawn's Wrath", category: "Class", rank: 50, ownClass: true, active: false },
        { name: "Assassination", category: "Class", rank: 50, subclassed: true },
      ],
      equipped: [
        { slot: "Chest", name: "Robe", type: "Light Chest", setName: "Lancer" },
        { slot: "Legs", name: "Guards", type: "Medium Legs", setName: "Lancer" },
        { slot: "Main Hand", bar: "front", name: "Dagger", type: "Dagger", setName: "Lancer" },
        { slot: "Off Hand", bar: "front", name: "Axe", type: "Axe" },
        { slot: "Main Hand", bar: "back", name: "Staff", type: "Lightning Staff" },
      ],
      champion: [{ name: "Warfare", stars: [{ name: "Deadly Aim", points: 50, slotted: true, kind: "slottable" }] }],
    });
    const map = classLineMap([
      { name: "Aedric Spear", className: "Templar" },
      { name: "Dawn's Wrath", className: "Templar" },
      { name: "Restoring Light", className: "Templar" },
      { name: "Assassination", className: "Nightblade" },
    ]);
    const r = readCharacter(c, map);
    assert.equal(r.allianceFit, "any-race-any-alliance");
    assert.deepEqual(r.lineup.borrowed, [{ line: "Assassination", fromClass: "Nightblade" }]);
    assert.deepEqual(r.lineup.swappedOut, ["Dawn's Wrath"]);
    assert.equal(r.classMastery, false);
    assert.equal(r.bars.front.line, "Dual Wield");
    assert.equal(r.bars.back.line, "Destruction Staff");
    assert.equal(r.bars.back.element, "shock");
    assert.deepEqual(
      r.armor.map((a) => [a.line, a.pieces]),
      [["Light Armor", 1], ["Medium Armor", 1], ["Heavy Armor", 0]],
    );
    assert.equal(r.loadout.sets[0].front, 3);
    assert.equal(r.champion.find((x) => x.constellation === "Warfare")?.freeSlots, 3);
  });
});
