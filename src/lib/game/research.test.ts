import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canCraft, idleResearchSlots, researchByPiece } from "./research";
import { parsePieceType } from "./equipment";

const line = (name: string, known: number, researching = 0) => ({
  name,
  traits: ["Sturdy", "Impenetrable", "Reinforced", "Well-fitted", "Training", "Infused", "Invigorating", "Divines", "Nirnhoned"].map(
    (t, i) => ({ name: t, known: i < known, researching: i >= known && i < known + researching }),
  ),
});

const research = {
  crafts: [
    { craft: "clothing", name: "Clothing", maxSlots: 3, lines: [line("Robe & Jerkin", 6), line("Arm Cops", 2, 1)] },
    { craft: "blacksmithing", name: "Blacksmithing", maxSlots: 3, lines: [line("Helm", 9)] },
  ],
};

describe("research", () => {
  const by = researchByPiece(research);

  it("places the game's research lines on piece kinds", () => {
    assert.equal(by.get("light-chest")?.known.size, 6);
    assert.equal(by.get("medium-shoulders")?.researching.size, 1);
    assert.equal(by.get("heavy-head")?.craft, "blacksmithing");
  });

  it("answers whether a piece can be crafted, with a trait", () => {
    const robe = parsePieceType("Light Chest")!;
    assert.deepEqual(canCraft(by, robe, 4), { ok: true, known: 6, hasTrait: null, missing: 0 });
    assert.equal(canCraft(by, robe, 4, "Divines").ok, false);
    assert.equal(canCraft(by, robe, 4, "Infused").ok, true);
    assert.equal(canCraft(by, parsePieceType("Medium Shoulders")!, 4).missing, 2);
    assert.equal(canCraft(by, parsePieceType("Heavy Feet")!, 2).ok, false);
  });

  it("counts idle research slots", () => {
    assert.deepEqual(idleResearchSlots(research), { clothing: 2, blacksmithing: 0 });
  });
});
