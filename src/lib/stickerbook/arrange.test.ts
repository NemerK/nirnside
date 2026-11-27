import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { arrangePieces } from "./arrange";

describe("arrangePieces", () => {
  it("files pieces like the sticker book", () => {
    const a = arrangePieces([
      { type: "Light Head", slot: "Head" },
      { type: "Heavy Shoulders", slot: "Shoulders" },
      { type: "Ring", slot: "Ring" },
      { type: "Necklace", slot: "Necklace" },
      { type: "Restoration Staff", slot: "Weapon" },
      { type: "Axe", slot: "Weapon" },
      { type: "Shield", slot: "Off hand" },
      { type: "Costume", slot: "s9" },
    ]);
    assert.ok(a.armor.get("Light")?.get("Head"));
    assert.ok(a.armor.get("Heavy")?.get("Shoulders"));
    assert.deepEqual(a.jewelry.map((p) => p.type), ["Necklace", "Ring"]);
    assert.deepEqual(a.weapons.map((p) => p.type), ["Axe", "Restoration Staff", "Shield"]);
    assert.deepEqual(a.other.map((p) => p.type), ["Costume"]);
  });

  it("keeps a second piece for the same slot instead of dropping it", () => {
    const a = arrangePieces([{ type: "Heavy Head" }, { type: "Heavy Head" }]);
    assert.equal(a.armor.get("Heavy")?.size, 1);
    assert.equal(a.other.length, 1);
  });
});
