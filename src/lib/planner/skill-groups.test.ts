import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { abilitiesOnPlannerLine, groupPlannerLines, plannerClassScopeAllows, plannerLineKey } from "./skill-groups";

const classes = ["Dragonknight", "Nightblade", "Templar"];

describe("groupPlannerLines", () => {
  it("nests class lines under their class, and other lines under the category", () => {
    const groups = groupPlannerLines(
      [
        { name: "Siphoning", category: "Class", className: "Nightblade" },
        { name: "Assassination", category: "Class", className: "Nightblade" },
        { name: "Ardent Flame", category: "Class", className: "Dragonknight" },
        { name: "Bow", category: "Weapon", className: null },
        { name: "One Hand and Shield", category: "Weapon", className: null },
        { name: "Assault", category: "Alliance War", className: null },
      ],
      classes,
    );
    assert.deepEqual(
      groups.map((g) => g.title),
      ["Class", "Weapon", "Alliance War"],
    );
    const classGroup = groups[0];
    assert.equal(classGroup.classes?.[0]?.name, "Dragonknight");
    assert.deepEqual(
      classGroup.classes?.[0]?.lines.map((l) => l.name),
      ["Ardent Flame"],
    );
    assert.deepEqual(
      classGroup.classes?.[1]?.lines.map((l) => l.name),
      ["Assassination", "Siphoning"],
    );
    assert.deepEqual(
      groups[1].lines.map((l) => l.name),
      ["Bow", "One Hand and Shield"],
    );
  });
});

describe("class mastery stays with its class", () => {
  const abilities = [
    { name: "Inexorable Descent", lineName: "Class Mastery", className: "Dragonknight" },
    { name: "Booming Voice", lineName: "Class Mastery", className: "Dragonknight" },
    { name: "Nocturnal Inspiration", lineName: "Class Mastery", className: "Nightblade" },
    { name: "Font of Power", lineName: "Class Mastery", className: null },
    { name: "Lava Whip", lineName: "Ardent Flame", className: "Dragonknight" },
  ];

  it("lists only that class's passives on its Class Mastery line", () => {
    assert.deepEqual(
      abilitiesOnPlannerLine(abilities, { name: "Class Mastery", className: "Dragonknight" }).map((a) => a.name),
      ["Inexorable Descent", "Booming Voice"],
    );
    assert.deepEqual(
      abilitiesOnPlannerLine(abilities, { name: "Class Mastery", className: "Nightblade" }).map((a) => a.name),
      ["Nocturnal Inspiration"],
    );
    assert.deepEqual(
      abilitiesOnPlannerLine(abilities, { name: "Ardent Flame", className: "Dragonknight" }).map((a) => a.name),
      ["Lava Whip"],
    );
  });

  it("recognizes a mastery passive by its live name when the snapshot omitted the class", () => {
    const unnamed = [{ name: "Font of Power", lineName: "Class Mastery", className: null }];
    assert.deepEqual(
      abilitiesOnPlannerLine(unnamed, { name: "Class Mastery", className: "Sorcerer" }).map((a) => a.name),
      ["Font of Power"],
    );
    assert.deepEqual(
      abilitiesOnPlannerLine(unnamed, { name: "Class Mastery", className: "Dragonknight" }),
      [],
    );
  });

  it("keeps a selected class's lines and every non-class line", () => {
    assert.equal(plannerClassScopeAllows({ category: "Class", className: "Dragonknight" }, "Dragonknight"), true);
    assert.equal(plannerClassScopeAllows({ category: "Class", className: "Nightblade" }, "dragonknight"), false);
    assert.equal(plannerClassScopeAllows({ category: "Weapon", className: null }, "Dragonknight"), true);
    assert.equal(plannerClassScopeAllows({ category: "Class", className: "Nightblade" }, null), true);
  });

  it("gives each class's Class Mastery its own key", () => {
    assert.equal(plannerLineKey({ name: "Class Mastery", className: "Dragonknight" }) === plannerLineKey({ name: "Class Mastery", className: "Nightblade" }), false);
    assert.equal(plannerLineKey({ name: "Ardent Flame", className: "Dragonknight" }), "ardent flame");
  });
});
