import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { outfitFacets } from "./outfits";

describe("outfitFacets", () => {
  it("reads weight and slot from the piece name", () => {
    assert.deepEqual(outfitFacets({ name: "Dwemer Helmet" }), { kind: "armor", weight: "medium", slot: "head" });
    assert.deepEqual(outfitFacets({ name: "Dwemer Helm" }), { kind: "armor", weight: "heavy", slot: "head" });
    assert.deepEqual(outfitFacets({ name: "High Elf Epaulets" }), { kind: "armor", weight: "light", slot: "shoulders" });
    assert.deepEqual(outfitFacets({ name: "Orc Arm Cops" }), { kind: "armor", weight: "medium", slot: "shoulders" });
    assert.deepEqual(outfitFacets({ name: "Nord Sabatons" }), { kind: "armor", weight: "heavy", slot: "feet" });
  });

  it("files weight-less pieces under Special", () => {
    assert.deepEqual(outfitFacets({ name: "Jester's Mask" }), { kind: "armor", weight: "special", slot: "head" });
  });

  it("tells weapons apart", () => {
    assert.deepEqual(outfitFacets({ name: "Nord Battle Axe" }), { kind: "weapon", weapon: "battleaxe" });
    assert.deepEqual(outfitFacets({ name: "Nord Axe" }), { kind: "weapon", weapon: "axe" });
    assert.deepEqual(outfitFacets({ name: "Dwemer Inferno Staff" }), { kind: "weapon", weapon: "destruction" });
    assert.deepEqual(outfitFacets({ name: "Dwemer Restoration Staff" }), { kind: "weapon", weapon: "restoration" });
    assert.deepEqual(outfitFacets({ name: "Something" }, "Weapons"), { kind: "weapon", weapon: null });
  });

  it("prefers what the addon reported", () => {
    assert.deepEqual(outfitFacets({ name: "Odd Name", weight: "heavy", slot: "chest" }), {
      kind: "armor",
      weight: "heavy",
      slot: "chest",
    });
    assert.deepEqual(outfitFacets({ name: "Odd Name", slot: "weapon-bow" }), { kind: "weapon", weapon: "bow" });
  });
});
