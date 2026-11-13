import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { skillsForLinePlan, type LineSkillView } from "./line-plan";

const spear: LineSkillView[] = [
  { name: "Puncturing Strikes", icon: null, passive: false, purchased: true, morphs: ["Puncturing Sweep", "Biting Jabs"] },
  { name: "Piercing Javelin", icon: null, passive: false, purchased: false, morphs: ["Aurora Javelin", "Binding Javelin"] },
  { name: "Spear Wall", icon: null, passive: true, purchased: true, morphs: [] },
];

describe("skillsForLinePlan", () => {
  it("marks every skill mandatory when the line target is its maximum and nothing is planned", () => {
    const result = skillsForLinePlan({
      skills: spear,
      plans: [],
      lineName: "Aedric Spear",
      mandatoryRank: 50,
      maxRank: 50,
      tier: "essential",
    });
    assert.equal(result.implied, true);
    assert.deepEqual(
      result.skills.map((skill) => skill.name),
      ["Puncturing Strikes", "Piercing Javelin", "Spear Wall"],
    );
    assert.ok(result.skills.every((skill) => skill.tier === "essential" && skill.implied));
  });

  it("does not invent a full plan when the mandatory rank is below the line cap", () => {
    const result = skillsForLinePlan({
      skills: spear,
      plans: [],
      lineName: "Undaunted",
      mandatoryRank: 7,
      maxRank: 10,
      tier: "essential",
    });
    assert.equal(result.implied, false);
    assert.deepEqual(result.skills, []);
  });

  it("shows only the planned skills, including a chosen morph", () => {
    const result = skillsForLinePlan({
      skills: spear,
      plans: [{ target: "Puncturing Sweep", tier: "essential", lineName: "Aedric Spear" }],
      lineName: "Aedric Spear",
      mandatoryRank: 50,
      maxRank: 50,
      tier: "essential",
    });
    assert.equal(result.implied, false);
    assert.equal(result.skills.length, 1);
    assert.equal(result.skills[0]?.name, "Puncturing Sweep");
    assert.equal(result.skills[0]?.tier, "essential");
  });
});
