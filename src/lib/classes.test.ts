import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classFilterOrder, ESO_CLASSES } from "./classes";

describe("class filter order", () => {
  it("always lists every live class, then extras from the roster", () => {
    assert.deepEqual(classFilterOrder(["Nightblade", "Arcanist"]), [...ESO_CLASSES]);
    assert.deepEqual(classFilterOrder(["Nightblade", "CustomClass"]).slice(-1), ["CustomClass"]);
  });
});
