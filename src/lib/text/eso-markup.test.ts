import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { esoPlainText, parseEsoMarkup, stripBonusCount } from "./eso-markup";

describe("ESO tooltip markup", () => {
  it("colors |cRRGGBB runs and resets on |r", () => {
    const runs = parseEsoMarkup("|cffffffDeals |cFFCC001500|r Physical Damage.|r");
    assert.deepEqual(runs, [
      { text: "Deals ", color: "#ffffff" },
      { text: "1500", color: "#FFCC00" },
      { text: " Physical Damage.", color: "#ffffff" },
    ]);
  });

  it("keeps tooltip texture icons and link text", () => {
    const runs = parseEsoMarkup(
      "Applies |t32:32:/esoui/art/icons/ability_buff_minor_fracture.dds|t Minor Fracture via |H1:item:1|hMinor Fracture|h.",
    );
    assert.equal(runs.map((r) => r.text).join(""), "Applies  Minor Fracture via Minor Fracture.");
    assert.deepEqual(runs.find((r) => r.icon)?.icon, {
      path: "/esoui/art/icons/ability_buff_minor_fracture.dds",
      width: 32,
      height: 32,
    });
  });

  it("keeps unresolved value tokens instead of inventing a number", () => {
    const runs = parseEsoMarkup("Deals <<1>> damage.");
    assert.equal(runs.map((r) => r.text).join(""), "Deals <<1>> damage.");
  });

  it("turns a doubled pipe into one pipe", () => {
    assert.equal(parseEsoMarkup("a || b").map((r) => r.text).join(""), "a | b");
  });

  it("colors a set-bonus number and can flatten it for a native tooltip", () => {
    const raw = "Adds |cffffff868|r Maximum Stamina.";
    const runs = parseEsoMarkup(raw);
    assert.equal(runs.map((run) => run.text).join(""), "Adds 868 Maximum Stamina.");
    assert.equal(runs[1]?.color, "#ffffff");
    assert.equal(runs[1]?.text, "868");
    assert.equal(esoPlainText(raw), "Adds 868 Maximum Stamina.");
  });
});

describe("stripBonusCount", () => {
  it("drops the game's item-count prefix", () => {
    assert.equal(stripBonusCount("(2 items) Adds 1401 Armor"), "Adds 1401 Armor");
    assert.equal(stripBonusCount("(1 item) Adds |cffffff434|r Magicka"), "Adds |cffffff434|r Magicka");
    assert.equal(stripBonusCount("Adds 1401 Armor"), "Adds 1401 Armor");
  });
});
