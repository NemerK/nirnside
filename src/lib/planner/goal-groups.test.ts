import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupPlacedGoals, type GoalCatalog } from "./goal-groups";

const catalog: GoalCatalog = {
  lines: [
    { name: "Ardent Flame", category: "Class", className: "Dragonknight" },
    { name: "Assassination", category: "Class", className: "Nightblade" },
    { name: "Herald of the Tome", category: "Class", className: "Arcanist" },
    { name: "Bow", category: "Weapon", className: null },
    {
      name: "Class Mastery",
      category: "Class",
      className: "Dragonknight",
      classNames: ["Dragonknight", "Nightblade", "Arcanist"],
    },
  ],
  abilities: [
    { name: "Lava Whip", lineName: "Ardent Flame", className: "Dragonknight", category: "Class" },
    { name: "Relentless Focus", lineName: "Assassination", className: "Nightblade", category: "Class" },
    { name: "Soul Harvest", lineName: "Assassination", className: "Nightblade", category: "Class" },
    { name: "Snipe", lineName: "Bow", className: null, category: "Weapon" },
  ],
  scripts: [{ name: "Flame Damage", slot: "focus" }],
};

describe("groupPlacedGoals", () => {
  it("keeps each class in its own group and lines inside that class", () => {
    const groups = groupPlacedGoals(
      [
        { domain: "ability" as const, target: "Soul Harvest" },
        { domain: "ability" as const, target: "Lava Whip" },
        { domain: "ability" as const, target: "Relentless Focus" },
        { domain: "ability" as const, target: "Snipe" },
        { domain: "script" as const, target: "Flame Damage" },
      ],
      catalog,
    );
    assert.deepEqual(
      groups.map((group) => ({
        title: group.title,
        sections: group.sections.map((section) => ({ title: section.title, items: section.items.map((item) => item.target) })),
      })),
      [
        {
          title: "Dragonknight",
          sections: [{ title: "Ardent Flame", items: ["Lava Whip"] }],
        },
        {
          title: "Nightblade",
          sections: [{ title: "Assassination", items: ["Soul Harvest", "Relentless Focus"] }],
        },
        {
          title: "Weapon",
          sections: [{ title: "Bow", items: ["Snipe"] }],
        },
        {
          title: "Scribing",
          sections: [{ title: "Focus", items: ["Flame Damage"] }],
        },
      ],
    );
  });

  it("drops every other class when one character class is in view", () => {
    const groups = groupPlacedGoals(
      [
        { domain: "ability" as const, target: "Lava Whip" },
        { domain: "ability" as const, target: "Relentless Focus" },
        { domain: "skillline" as const, target: "Herald of the Tome" },
        { domain: "skillline" as const, target: "Bow" },
      ],
      catalog,
      "Nightblade",
    );
    assert.deepEqual(
      groups.map((group) => group.title),
      ["Nightblade", "Weapon"],
    );
    assert.deepEqual(groups[0]?.sections[0]?.items.map((item) => item.target), ["Relentless Focus"]);
    assert.deepEqual(groups[1]?.sections[0]?.items.map((item) => item.target), ["Bow"]);
  });

  it("puts a class-scoped Class Mastery target on that class only", () => {
    const groups = groupPlacedGoals(
      [{ domain: "skillline" as const, target: "Class Mastery", scope: "class", scopeKey: "Arcanist" }],
      catalog,
    );
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.title, "Arcanist");
    assert.equal(groups[0]?.sections[0]?.title, "Class Mastery");
  });
});
