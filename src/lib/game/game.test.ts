import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canonicalTrait,
  compareSkillCategory,
  craftOf,
  isWeaponSlot,
  parsePieceType,
  parseWornSlot,
  pieceForResearchLine,
  pieceFromKey,
  pieceKey,
  pieceKindFromName,
  skillCategory,
  traitFamilyOf,
  traitsFor,
  pieceSlotFromText,
  weaponHandFromText,
  ALL_PIECE_WORDS,
} from "./index";

describe("piece kinds", () => {
  it("reads every label the addon writes", () => {
    assert.equal(pieceKey(parsePieceType("Heavy Head")!), "heavy-head");
    assert.equal(pieceKey(parsePieceType("Light Shoulders")!), "light-shoulders");
    assert.equal(pieceKey(parsePieceType("Medium Hands")!), "medium-hands");
    assert.equal(pieceKey(parsePieceType("Necklace")!), "necklace");
    assert.equal(pieceKey(parsePieceType("Ring")!), "ring");
    assert.equal(pieceKey(parsePieceType("Battle Axe")!), "battleaxe");
    assert.equal(pieceKey(parsePieceType("Axe")!), "axe");
    assert.equal(pieceKey(parsePieceType("Inferno Staff")!), "inferno");
    assert.equal(pieceKey(parsePieceType("Restoration Staff")!), "restoration");
    assert.equal(pieceKey(parsePieceType("Shield")!), "shield");
    assert.equal(pieceKey(parsePieceType("Head", "Light")!), "light-head");
    assert.equal(parsePieceType("Costume"), null);
  });

  it("reads piece words in names", () => {
    assert.equal(pieceKey(pieceKindFromName("Dwemer Helmet")!), "medium-head");
    assert.equal(pieceKey(pieceKindFromName("Dwemer Helm")!), "heavy-head");
    assert.equal(pieceKey(pieceKindFromName("Orc Arm Cops")!), "medium-shoulders");
    assert.equal(pieceKey(pieceKindFromName("Breton Jerkin")!), "light-chest");
    assert.equal(pieceKey(pieceKindFromName("Nord Battle Axe")!), "battleaxe");
    assert.equal(pieceKindFromName("Jester's Mask"), null);
  });

  it("round-trips keys", () => {
    for (const k of ["heavy-feet", "ring", "greatsword", "shield"]) assert.equal(pieceKey(pieceFromKey(k)!), k);
  });
});

describe("crafting and research", () => {
  it("knows which station makes what", () => {
    assert.equal(craftOf(parsePieceType("Heavy Chest")!), "blacksmithing");
    assert.equal(craftOf(parsePieceType("Medium Chest")!), "clothing");
    assert.equal(craftOf(parsePieceType("Shield")!), "woodworking");
    assert.equal(craftOf(parsePieceType("Lightning Staff")!), "woodworking");
    assert.equal(craftOf(parsePieceType("Dagger")!), "blacksmithing");
    assert.equal(craftOf(parsePieceType("Ring")!), "jewelry");
  });

  it("maps the game's research line names to pieces", () => {
    assert.equal(pieceKey(pieceForResearchLine("Robe & Jerkin")!), "light-chest");
    assert.equal(pieceKey(pieceForResearchLine("Arm Cops")!), "medium-shoulders");
    assert.equal(pieceKey(pieceForResearchLine("Pauldron")!), "heavy-shoulders");
    assert.equal(pieceKey(pieceForResearchLine("Greatsword")!), "greatsword");
    assert.equal(pieceKey(pieceForResearchLine("Necklace")!), "necklace");
  });

  it("gives shields armor traits", () => {
    assert.equal(traitFamilyOf(parsePieceType("Shield")!), "armor");
    assert.ok(traitsFor(parsePieceType("Shield")!).includes("Divines"));
    assert.ok(traitsFor(parsePieceType("Bow")!).includes("Precise"));
    assert.equal(canonicalTrait("Armor Well-Fitted"), "Well-fitted");
    assert.equal(canonicalTrait("Jewelry Arcane"), "Arcane");
  });
});

describe("worn slots", () => {
  it("never treats Hands as a weapon slot", () => {
    assert.equal(parseWornSlot("Hands"), "hands");
    assert.equal(isWeaponSlot(parseWornSlot("Hands")), false);
    assert.equal(parseWornSlot("Back Off Hand"), "offhand");
    assert.equal(parseWornSlot("Main Hand"), "mainhand");
    assert.equal(parseWornSlot("Ring 2"), "ring2");
  });
});

describe("skill categories", () => {
  it("normalizes and orders like the Skills window", () => {
    assert.equal(skillCategory("alliance war"), "Alliance War");
    assert.equal(skillCategory("SKILL_TYPE_TRADESKILL"), "Craft");
    assert.equal(skillCategory("weapon", "Templar"), "Class");
    const sorted = ["Craft", "World", "Class", "Guild"].sort(compareSkillCategory);
    assert.deepEqual(sorted, ["Class", "World", "Guild", "Craft"]);
  });
});

describe("piece slots from any wording", () => {
  it("reads weighted words, unique-piece words, labels, jewelry and weapons", () => {
    assert.deepEqual(pieceSlotFromText("Null Arca Guards"), { kind: "armor", slot: "legs", weight: "medium" });
    assert.deepEqual(pieceSlotFromText("Gauntlet of the Dread"), { kind: "armor", slot: "hands", weight: "heavy" });
    assert.deepEqual(pieceSlotFromText("Spaulder of Ruin"), { kind: "armor", slot: "shoulders", weight: null });
    assert.deepEqual(pieceSlotFromText("Hands"), { kind: "armor", slot: "hands", weight: null });
    assert.deepEqual(pieceSlotFromText("Velothi Ur-Mage's Amulet"), { kind: "jewelry", jewelry: "necklace" });
    assert.deepEqual(pieceSlotFromText("Nord Battle Axe"), { kind: "weapon", weapon: "battleaxe" });
    assert.equal(pieceSlotFromText("Slivers of the Null Arca"), null);
    assert.equal(pieceSlotFromText("Main Hand"), null);
    assert.equal(weaponHandFromText("Main Hand"), "one");
    assert.equal(weaponHandFromText("Two-Handed"), "two");
  });
  it("lists every piece word, longest first, with plurals", () => {
    assert.ok(ALL_PIECE_WORDS.includes("spaulders"));
    assert.ok(ALL_PIECE_WORDS.includes("gauntlet"));
    assert.ok(ALL_PIECE_WORDS.indexOf("inferno staff") < ALL_PIECE_WORDS.indexOf("staff"));
  });
});
