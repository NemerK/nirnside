import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAchievementComplete, presentAchievements } from "./present";
import { PITHKA_TABS, allTrackedIds } from "./pithka";

describe("presentAchievements", () => {
  it("tallies unique Pithka ids as done/total", () => {
    const firstTab = PITHKA_TABS[0]!;
    const ids = allTrackedIds(firstTab.rows);
    assert.ok(ids.length > 0);
    const sample = ids.slice(0, 3);
    const present = presentAchievements({ completedIds: sample });
    assert.equal(present.pithka.done, sample.length);
    assert.ok(present.pithka.total >= sample.length);
    assert.equal(present.hasRecords, false);
    for (const id of sample) {
      assert.equal(isAchievementComplete(present, id), true);
    }
    assert.equal(isAchievementComplete(present, 999999), false);
  });

  it("indexes structured records when provided", () => {
    const present = presentAchievements({
      completedIds: [1],
      records: [
        {
          id: 1,
          name: "Clear",
          description: "Done",
          points: 10,
          category: "Trials",
          content: "AA",
          completed: true,
          title: null,
          date: null,
        },
      ],
      legacyNames: ["Clear"],
    });
    assert.equal(present.hasRecords, true);
    assert.equal(present.recordsById.get(1)?.name, "Clear");
    assert.ok(present.earnedNames.has("clear"));
  });
});
