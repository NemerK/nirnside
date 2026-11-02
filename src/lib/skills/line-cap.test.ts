import assert from "node:assert/strict";
import { describe, it } from "node:test";
import catalog from "../../../data/catalog/skills.json";
import { editSkillLineRanks, skillLineCap } from "./line-cap";

describe("skillLineCap", () => {
  it("matches the catalog cap on every seeded line", () => {
    for (const line of catalog.skillLines) {
      const cap = skillLineCap(line.name);
      if (line.name === "Class Mastery") {
        assert.equal(cap, null);
        continue;
      }
      assert.equal(cap, line.maxRank, line.name);
    }
  });

  it("knows antiquities lines that are not in the reference seed", () => {
    assert.equal(skillLineCap("Scrying"), 10);
    assert.equal(skillLineCap("Excavation"), 10);
  });

  it("does not invent a cap", () => {
    assert.equal(skillLineCap("Volendrung"), null);
    assert.equal(skillLineCap("Vengeance"), null);
    assert.equal(skillLineCap(""), null);
  });
});

describe("editSkillLineRanks", () => {
  it("sets mandatory, then lets extra move only above it", () => {
    assert.deepEqual(editSkillLineRanks("mandatory", 10, 0, 0, 7), { mandatory: 7, extra: 0 });
    // Below the mandatory floor: the extra bar does not move.
    assert.deepEqual(editSkillLineRanks("extra", 10, 7, 0, 4), { mandatory: 7, extra: 0 });
    assert.deepEqual(editSkillLineRanks("extra", 10, 7, 0, 9), { mandatory: 7, extra: 9 });
    assert.deepEqual(editSkillLineRanks("extra", 10, 7, 9, 7), { mandatory: 7, extra: 0 });
    assert.deepEqual(editSkillLineRanks("extra", 10, 7, 9, 12), { mandatory: 7, extra: 10 });
    assert.deepEqual(editSkillLineRanks("mandatory", 10, 7, 9, 8), { mandatory: 8, extra: 9 });
    assert.deepEqual(editSkillLineRanks("mandatory", 10, 7, 9, 9), { mandatory: 9, extra: 0 });
  });
});
