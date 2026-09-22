import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseEsoMarkup } from "./eso-markup";

describe("ESO tooltip markup", () => {
  it("colors |cRRGGBB runs and resets on |r", () => {
    const runs = parseEsoMarkup("|cffffffDeals |cFFCC001500|r Physical Damage.|r");
    assert.deepEqual(runs, [
      { text: "Deals ", color: "#ffffff" },
      { text: "1500", color: "#FFCC00" },
      { text: " Physical Damage.", color: "#ffffff" },
    ]);
  });

  it("strips icon tags and keeps link text", () => {
    const runs = parseEsoMarkup(
      "Applies |t32:32:/esoui/art/icons/ability_buff_minor_fracture.dds|t Minor Fracture via |H1:item:1|hMinor Fracture|h.",
    );
    assert.equal(runs.map((r) => r.text).join(""), "Applies  Minor Fracture via Minor Fracture.");
    assert.equal(runs.every((r) => r.color == null), true);
  });

  it("keeps unresolved value tokens instead of inventing a number", () => {
    const runs = parseEsoMarkup("Deals <<1>> damage.");
    assert.equal(runs.map((r) => r.text).join(""), "Deals <<1>> damage.");
  });

  it("turns a doubled pipe into one pipe", () => {
    assert.equal(parseEsoMarkup("a || b").map((r) => r.text).join(""), "a | b");
  });
});
