import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  allianceFit,
  barWeaponLine,
  championState,
  classLineMap,
  classLineup,
  classMasteryAvailable,
  earnedPerConstellation,
  findRace,
  isRacialLineFor,
  lineUsableOnBar,
  readBar,
} from "./index";

describe("characters: race and alliance", () => {
  it("knows each race's home alliance and what a mismatch means", () => {
    assert.equal(allianceFit("Redguard", "Daggerfall Covenant"), "home");
    assert.equal(allianceFit("Redguard", "Aldmeri Dominion"), "any-race-any-alliance");
    assert.equal(allianceFit("Imperial", "Ebonheart Pact"), "chosen");
    assert.equal(findRace("Dunmer")?.name, "Dark Elf");
    assert.ok(isRacialLineFor("Redguard", "Redguard"));
  });
});

describe("classes and subclassing", () => {
  const map = classLineMap([
    { name: "Aedric Spear", className: "Templar" },
    { name: "Dawn's Wrath", className: "Templar" },
    { name: "Restoring Light", className: "Templar" },
    { name: "Assassination", className: "Nightblade" },
    { name: "Herald of the Tome", className: "Arcanist" },
    { name: "Shadow", className: "Nightblade" },
  ]);

  it("reads a pure class", () => {
    const l = classLineup(
      "Templar",
      [{ name: "Aedric Spear" }, { name: "Dawn's Wrath" }, { name: "Restoring Light" }],
      map,
    );
    assert.equal(l.subclassing, false);
    assert.equal(l.native.length, 3);
    assert.ok(classMasteryAvailable(l));
  });

  it("reads a Templar borrowing two lines, with the scan's flags", () => {
    const l = classLineup(
      "Templar",
      [
        { name: "Aedric Spear", ownClass: true, active: true },
        { name: "Dawn's Wrath", ownClass: true, active: false },
        { name: "Restoring Light", ownClass: true, active: false },
        { name: "Assassination", subclassed: true },
        { name: "Herald of the Tome", subclassed: true },
      ],
      map,
    );
    assert.deepEqual(l.native, ["Aedric Spear"]);
    assert.deepEqual(l.swappedOut, ["Dawn's Wrath", "Restoring Light"]);
    assert.deepEqual(l.borrowed.map((b) => b.fromClass), ["Nightblade", "Arcanist"]);
    assert.deepEqual(l.problems, []);
    assert.equal(classMasteryAvailable(l), false);
  });

  it("names a lineup the rules don't allow", () => {
    const l = classLineup("Templar", [{ name: "Assassination", subclassed: true }, { name: "Shadow", subclassed: true }], map);
    assert.equal(l.problems.length, 1);
  });
});

describe("champion points", () => {
  it("splits earned points in the game's rotation and caps them", () => {
    assert.deepEqual(earnedPerConstellation(10), { Craft: 4, Warfare: 3, Fitness: 3 });
    assert.deepEqual(earnedPerConstellation(9999), { Craft: 1200, Warfare: 1200, Fitness: 1200 });
  });

  it("reads slots and idle slottables", () => {
    const [craft, warfare] = championState([
      { name: "Craft", stars: [{ name: "Steed's Blessing", points: 50, slotted: true, kind: "slottable" }] },
      {
        name: "Warfare",
        stars: [
          { name: "Deadly Aim", points: 50, slotted: false, kind: "slottable" },
          { name: "Precision", points: 20, slotted: false, kind: "passive" },
        ],
      },
    ]);
    assert.equal(craft.freeSlots, 3);
    assert.deepEqual(warfare.idleSlottables, ["Deadly Aim"]);
    assert.equal(warfare.spent, 70);
  });
});

describe("weapons and their skill lines", () => {
  it("knows what each bar makes", () => {
    assert.equal(barWeaponLine("dagger", "sword"), "Dual Wield");
    assert.equal(barWeaponLine("sword", "shield"), "One Hand and Shield");
    assert.equal(barWeaponLine("sword", null), null);
    assert.equal(barWeaponLine("maul", null), "Two Handed");
    assert.equal(barWeaponLine("lightning", null), "Destruction Staff");
    assert.equal(barWeaponLine("restoration", null), "Restoration Staff");
    assert.equal(barWeaponLine("bow", null), "Bow");
  });

  it("knows a weapon ability needs its weapon on the bar", () => {
    assert.equal(lineUsableOnBar("Dual Wield", "dagger", "dagger"), true);
    assert.equal(lineUsableOnBar("Dual Wield", "greatsword", null), false);
    assert.equal(lineUsableOnBar("Assassination", "greatsword", null), true);
  });

  it("reads the exact weapons and the staff element", () => {
    assert.deepEqual(readBar("axe", "dagger").types, { axe: 1, dagger: 1 });
    assert.equal(readBar("inferno", null).element, "fire");
  });
});
