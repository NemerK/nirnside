import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findMythic, hrefForMythicOrSet, isMythicCategory, mythicNameKey } from "./mythic-match";

const mythics = [
  { setId: 574, name: "Ring of the Pale Order" },
  { setId: 583, name: "Spaulder of Ruin" },
];

describe("findMythic", () => {
  it("matches the stickerbook name to the antiquity set", () => {
    assert.equal(mythicNameKey("Ring of the Pale Order"), "pale order");
    assert.equal(findMythic(mythics, { name: "Pale Order" })?.setId, 574);
    assert.equal(findMythic(mythics, { setId: 583, name: "Something else" })?.name, "Spaulder of Ruin");
  });

  it("sends a mythic to its missing components instead of the encyclopedia", () => {
    assert.equal(
      hrefForMythicOrSet(mythics, { name: "Pale Order" }, "/encyclopedia/sets/set-pale-order"),
      "/stickerbook#mythic-574",
    );
    assert.equal(
      hrefForMythicOrSet(mythics, { name: "Deadly Strike" }, "/encyclopedia/sets/set-deadly-strike"),
      "/encyclopedia/sets/set-deadly-strike",
    );
    assert.equal(isMythicCategory("Mythic Items"), true);
    assert.equal(isMythicCategory("Trials"), false);
  });
});
