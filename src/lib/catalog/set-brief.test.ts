import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lookupSetBrief, type SetBrief } from "./set-brief";

const sets: SetBrief[] = [
  {
    id: "set-pale-order",
    name: "Ring of the Pale Order",
    setId: 574,
    category: "Mythic",
    maxEquip: 1,
    source: "reference",
    bonuses: [{ pieces: 1, text: "Heal for a percentage of your damage done." }],
  },
  {
    id: "set-coral",
    name: "Coral Riptide",
    setId: 693,
    category: "Trial",
    maxEquip: 5,
    source: "reference",
    bonuses: [{ pieces: 5, text: "Increases damage." }],
  },
  {
    id: "set-orders",
    name: "Order's Wrath",
    setId: 583000,
    category: "Crafted",
    maxEquip: 5,
    source: "reference",
    bonuses: [],
  },
];

describe("lookupSetBrief", () => {
  it("matches a worn mythic name and a set id to the catalog entry", () => {
    assert.equal(lookupSetBrief(sets, { name: "Pale Order" })?.id, "set-pale-order");
    assert.equal(lookupSetBrief(sets, { name: "Coral Riptide" })?.id, "set-coral");
    assert.equal(lookupSetBrief(sets, { setId: 574, name: "anything" })?.name, "Ring of the Pale Order");
  });

  it("does not borrow a different set that merely shares a word", () => {
    assert.equal(lookupSetBrief(sets, { name: "Order's Wrath" })?.id, "set-orders");
    assert.equal(lookupSetBrief(sets, { name: "Unknown Set" }), null);
  });
});
