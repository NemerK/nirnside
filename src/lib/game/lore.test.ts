import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canCraftInStyle,
  chapterFor,
  chapterOfName,
  findMundus,
  parsePieceType,
  readCompanion,
  readMundus,
  recipeFamily,
  recipeGrade,
  styleKey,
  styleKnowledge,
} from "./index";

describe("motifs and styles", () => {
  it("maps chapters to pieces", () => {
    assert.equal(chapterFor(parsePieceType("Heavy Head")!), "Helmets");
    assert.equal(chapterFor(parsePieceType("Battle Axe")!), "Axes");
    assert.equal(chapterFor(parsePieceType("Lightning Staff")!), "Staves");
    assert.equal(chapterFor(parsePieceType("Ring")!), null);
    assert.equal(chapterOfName("Crafting Motif 27: Ebonheart Pact Axes"), "Axes");
  });

  it("shares one style key between motifs and outfit styles", () => {
    assert.equal(styleKey("Crafting Motif 14: Dwemer Style"), "dwemer");
    assert.equal(styleKey("Crafting Motif 27: Ebonheart Pact Axes"), "ebonheart pact");
    assert.equal(styleKey("Dwemer"), "dwemer");
  });

  it("knows what a character can craft in a style", () => {
    const partial = styleKnowledge({
      name: "Ebonheart Pact",
      known: 2,
      total: 14,
      chapters: [
        { name: "Ebonheart Pact Axes", known: true },
        { name: "Ebonheart Pact Helmets", known: true },
        { name: "Ebonheart Pact Bows", known: false },
      ],
    });
    assert.equal(canCraftInStyle(partial, parsePieceType("Maul")!), false);
    assert.equal(canCraftInStyle(partial, parsePieceType("Battle Axe")!), true);
    assert.equal(canCraftInStyle(partial, parsePieceType("Light Head")!), true);
    const book = styleKnowledge({ name: "High Elf", known: 1, total: 1, chapters: [] });
    assert.equal(book.complete, true);
  });
});

describe("mundus", () => {
  it("finds stones and reads Divines and Twice-Born Star", () => {
    assert.equal(findMundus("Boon: The Shadow")?.boosts, "Critical Damage and Critical Healing");
    const r = readMundus("The Thief", [
      ...["Head", "Chest", "Legs", "Feet", "Hands"].map((s) => ({ slot: s, type: `Light ${s}`, setName: "Twice-Born Star", trait: "Divines" })),
      { slot: "Ring 1", type: "Ring", trait: "Arcane" },
    ]);
    assert.equal(r.allowed, 2);
    assert.equal(r.divinesPieces, 5);
  });
});

describe("food", () => {
  it("knows what each recipe family boosts and its grade", () => {
    const ragout = recipeFamily("Ragout")!;
    assert.deepEqual(ragout.boosts.map((b) => b.resource), ["health", "stamina"]);
    assert.equal(recipeGrade(ragout), "difficult");
    assert.equal(recipeFamily("Distillates")!.kind, "drink");
    assert.equal(recipeFamily("Delicacies"), null);
  });
});

describe("companions", () => {
  it("reads level, ultimate and class theme", () => {
    const c = readCompanion({ name: "Isobel Veloise", level: 20, rapport: "Close Friends" });
    assert.equal(c.ultimateOpen, true);
    assert.equal(c.theme, "Templar");
    assert.equal(readCompanion({ name: "Mirri Elendis", level: 12 }).maxed, false);
  });
});
