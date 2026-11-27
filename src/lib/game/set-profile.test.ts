import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeSetProfile, setComesIn, setProfileFrom } from "./set-profile";

const armor = (weights: string[], slots: string[]) =>
  weights.flatMap((w) => slots.map((s) => ({ type: `${w} ${s}` })));
const ALL = ["Head", "Shoulders", "Chest", "Hands", "Waist", "Legs", "Feet"];
const WEAPONS = ["Axe", "Mace", "Sword", "Dagger", "Battle Axe", "Maul", "Greatsword", "Bow", "Inferno Staff", "Ice Staff", "Lightning Staff", "Restoration Staff", "Shield"];

describe("set profiles", () => {
  it("understands a full trial or dungeon set", () => {
    const p = setProfileFrom([
      ...armor(["Light", "Medium", "Heavy"], ALL),
      { type: "Necklace" },
      { type: "Ring" },
      ...WEAPONS.map((type) => ({ type })),
    ]);
    assert.equal(p.shape, "full");
    assert.deepEqual(p.weights, ["light", "medium", "heavy"]);
    assert.ok(setComesIn(p, "heavy", "legs"));
    assert.equal(
      describeSetProfile(p),
      "Light, medium or heavy armor, all 7 armor slots · necklace and rings · every weapon and a shield",
    );
  });

  it("understands a monster set", () => {
    const p = setProfileFrom(armor(["Light", "Medium", "Heavy"], ["Head", "Shoulders"]));
    assert.equal(p.shape, "head-shoulders");
    assert.ok(setComesIn(p, "light", "head"));
    assert.equal(setComesIn(p, "light", "chest"), false);
    assert.equal(describeSetProfile(p), "Light, medium or heavy armor, head and shoulders");
  });

  it("understands heavy-only and weapon-only sets", () => {
    const heavy = setProfileFrom(armor(["Heavy"], ALL));
    assert.deepEqual(heavy.weights, ["heavy"]);
    assert.equal(setComesIn(heavy, "light"), false);
    const arena = setProfileFrom([{ type: "Bow" }, { type: "Inferno Staff" }]);
    assert.equal(arena.shape, "weapons");
    assert.equal(describeSetProfile(arena), "Weapons only: bow and inferno staff");
  });

  it("understands a mythic and adds learned pieces", () => {
    assert.equal(setProfileFrom([{ type: "Ring" }]).shape, "single");
    const learned = setProfileFrom([], ["medium-head", "medium-shoulders"]);
    assert.equal(learned.shape, "head-shoulders");
    assert.deepEqual(learned.weights, ["medium"]);
  });
});
