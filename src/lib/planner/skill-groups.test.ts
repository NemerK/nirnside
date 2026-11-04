import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { groupPlannerLines } from "./skill-groups";

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
