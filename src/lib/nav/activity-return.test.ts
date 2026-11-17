import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { activityLabel, activitySection, leavesActivity } from "./activity-return";

describe("activity return", () => {
  it("treats a jump from a character to the encyclopedia as leaving", () => {
    assert.equal(
      leavesActivity("/characters/char-001?tab=equipped", "/encyclopedia/sets/set-slimecraw"),
      true,
    );
    assert.equal(activitySection("/characters/char-001"), "characters");
    assert.equal(activitySection("/encyclopedia/sets/set-slimecraw"), "encyclopedia");
  });

  it("stays inside one activity when the link is only a child page", () => {
    assert.equal(leavesActivity("/encyclopedia/sets", "/encyclopedia/sets/set-slimecraw"), false);
    assert.equal(leavesActivity("/characters/char-001?tab=equipped", "/characters"), false);
    assert.equal(leavesActivity("/characters/char-001?tab=overview", "/characters/char-001?tab=equipped"), false);
  });

  it("ignores hashes and addresses outside the app", () => {
    assert.equal(leavesActivity("/inventory", "#bags"), false);
    assert.equal(leavesActivity("/inventory", "https://example.com/sets"), false);
  });

  it("names a character tab and a dashboard section", () => {
    assert.equal(activityLabel("/characters/char-001?tab=equipped", "Sings-With-Shadows"), "Sings-With-Shadows · Equipped");
    assert.equal(activityLabel("/characters/char-001", "Sings-With-Shadows"), "Sings-With-Shadows");
    assert.equal(activityLabel("/characters/char-001?tab=overview", "Sings-With-Shadows"), "Sings-With-Shadows");
    assert.equal(activityLabel("/dashboard?char=char-001&section=skills", "Dashboard"), "Dashboard · Skills");
  });

  it("uses the page heading, then the section name", () => {
    assert.equal(activityLabel("/encyclopedia/sets/set-slimecraw", "Slimecraw"), "Slimecraw");
    assert.equal(activityLabel("/inventory?setName=Slimecraw", ""), "Inventory");
  });
});
