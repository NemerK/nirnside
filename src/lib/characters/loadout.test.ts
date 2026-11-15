import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { placeEquipped, tallySets, type WornSlot } from "./loadout";

function piece(slot: string, bar: WornSlot["bar"] = null, setName: string | null = null): WornSlot {
  return { slot, bar, setName };
}

describe("placeEquipped", () => {
  it("puts armor and jewelry on the paper doll and weapons on their bars", () => {
    const placed = placeEquipped([
      piece("Head"),
      piece("Shoulders"),
      piece("Chest"),
      piece("Hands"),
      piece("Waist"),
      piece("Legs"),
      piece("Feet"),
      piece("Necklace"),
      piece("Ring 1"),
      piece("Ring 2"),
      piece("Main Hand", "front"),
      piece("Off Hand", "front"),
      piece("Main Hand", "back"),
    ]);

    assert.equal(placed.head?.slot, "Head");
    assert.equal(placed.waist?.slot, "Waist");
    assert.equal(placed.neck?.slot, "Necklace");
    assert.deepEqual(
      placed.rings.map((ring) => ring.slot),
      ["Ring 1", "Ring 2"],
    );
    assert.equal(placed.front.main?.slot, "Main Hand");
    assert.equal(placed.front.off?.slot, "Off Hand");
    assert.equal(placed.back.main?.slot, "Main Hand");
    assert.equal(placed.back.off, undefined);
    assert.deepEqual(placed.other, []);
  });

  it("keeps a piece whose slot name is not one of the paper-doll slots", () => {
    const placed = placeEquipped([piece("Costume")]);
    assert.equal(placed.other[0]?.slot, "Costume");
    assert.equal(placed.chest, undefined);
  });
});

describe("tallySets", () => {
  it("counts pieces across armor and both bars", () => {
    const sets = tallySets([
      piece("Chest", null, "Coral Riptide"),
      piece("Main Hand", "front", "Coral Riptide"),
      piece("Off Hand", "front", "Coral Riptide"),
      piece("Head", null, "Slimecraw"),
      piece("Shoulders", null, "Slimecraw"),
      piece("Main Hand", "back", null),
    ]);
    assert.deepEqual(sets, [
      { name: "Coral Riptide", count: 3 },
      { name: "Slimecraw", count: 2 },
    ]);
  });
});
