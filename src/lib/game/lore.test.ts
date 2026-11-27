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
  it("knows the Update 51 stones", () => {
    assert.equal(findMundus("Boon: The Shadow")?.boosts, "Critical Damage and Critical Healing");
    assert.equal(findMundus("The Warrior")?.boosts, "Weapon and Spell Damage");
    assert.equal(findMundus("Apprentice")?.combat, false);
  });
  it("reads Divines and Twice-Born Star", () => {
    const r = readMundus({ mundus: "The Thief" }, [
      ...["Head", "Chest", "Legs", "Feet", "Hands"].map((s) => ({ slot: s, type: `Light ${s}`, setName: "Twice-Born Star", trait: "Divines" })),
      { slot: "Ring 1", type: "Ring", trait: "Arcane" },
    ]);
    assert.equal(r.allowed, 2);
    assert.equal(r.divinesPieces, 5);
    assert.equal(r.secondBlessingFree, true);
  });
  it("prefers the game's own text: the saved buff, then the catalog", () => {
    const catalog = [{ name: "The Warrior", description: "Increases Weapon and Spell Damage by 238." }];
    const fromBuff = readMundus(
      {
        mundusBoons: ["The Warrior"],
        buffs: [{ name: "Boon: The Warrior", mundus: true, description: "Increases Weapon and Spell Damage by 350." }],
      },
      [],
      catalog,
    );
    assert.equal(fromBuff.blessings[0].text, "Increases Weapon and Spell Damage by 350.");
    assert.equal(fromBuff.blessings[0].textFrom, "buff");
    const fromCatalog = readMundus({ mundus: "The Warrior" }, [], catalog);
    assert.equal(fromCatalog.blessings[0].textFrom, "catalog");
    assert.equal(readMundus({ mundus: null }, []).blessings.length, 0);
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
