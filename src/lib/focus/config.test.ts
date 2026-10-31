import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Throwaway DB — focus choices are local player state, never game data. The
// config module loads lazily so it reads this path, not the default ./data one.
process.env.NIRNSIDE_DB = join(tmpdir(), `nirnside-focus-test-${process.pid}.db`);

type Focus = typeof import("./config");
let focus: Focus;

before(async () => {
  focus = await import("./config");
});

describe("focus areas", () => {
  it("defaults to every area on for an untouched character", () => {
    const areas = focus.focusAreasFor("someone-new");
    assert.deepEqual(areas, focus.FOCUS_AREAS.map((a) => a.id));
    assert.equal(focus.isAreaOn("someone-new", "skills"), true);
  });

  it("stores the chosen areas per character, so characters stay independent", () => {
    focus.setFocusAreas("toon-a", ["skills", "crafting"]);
    assert.deepEqual(focus.focusAreasFor("toon-a"), ["skills", "crafting"]);
    // Another toon keeps its own (default) selection.
    assert.deepEqual(focus.focusAreasFor("toon-b"), focus.FOCUS_AREAS.map((a) => a.id));
  });

  it("drops unknown area ids instead of storing junk", () => {
    focus.setFocusAreas("toon-a", ["skills", "pvp", 5, null]);
    assert.deepEqual(focus.focusAreasFor("toon-a"), ["skills"]);
  });

  it("remembers an explicitly all-off selection (not the default)", () => {
    focus.setFocusAreas("toon-c", []);
    assert.deepEqual(focus.focusAreasFor("toon-c"), []);
  });

  it("rejects a blank character id instead of overwriting everyone's config", () => {
    focus.setFocusChar(null);
    focus.setFocusAreas("   ", ["skills"]);
    assert.equal(focus.getFocusConfig().char, null);
  });
});

describe("focus character", () => {
  it("round-trips the last focused character", () => {
    focus.setFocusChar("toon-a");
    assert.equal(focus.getFocusConfig().char, "toon-a");
    focus.setFocusChar(null);
    assert.equal(focus.getFocusConfig().char, null);
  });
});
