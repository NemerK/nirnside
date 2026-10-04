import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Character, CharacterResearch, MotifStyle, OutfitStyleCategory, RecipeList } from "../snapshot/schema";
import {
  accountHasOutfitStylesScan,
  characterHasKnowledgeScan,
  formatResearchRemaining,
  motifKey,
  presentMotifs,
  presentOutfitStyles,
  presentRecipeLists,
  presentResearch,
  summarizeAccountKnowledge,
} from "./present";

function char(partial: Partial<Character> & { id: string; name: string }): Character {
  return {
    class: "Nightblade",
    race: "Khajiit",
    alliance: "Aldmeri Dominion",
    gender: null,
    level: 50,
    championPoints: 0,
    mundus: null,
    attributes: {},
    vampire: { isVampire: false, stage: 0 },
    werewolf: { isWerewolf: false },
    classMastery: false,
    classMasteries: [],
    skillLines: [],
    champion: [],
    equipped: [],
    companions: [],
    scribingScripts: [],
    research: { crafts: [] },
    motifs: [],
    recipeLists: [],
    lastSeen: 1,
    gold: 0,
    telVar: 0,
    alliancePoints: 0,
    dailies: null,
    archivedAt: null,
    wardrobe: null,
    ...partial,
  };
}

const research: CharacterResearch = {
  crafts: [
    {
      craft: "blacksmithing",
      name: "Blacksmithing",
      maxSlots: 3,
      lines: [
        {
          name: "Axe",
          traits: [
            { name: "Powered", known: true, researching: false },
            { name: "Nirnhoned", known: false, researching: true, remainingSeconds: 3600 * 26 },
          ],
        },
        {
          name: "Helm",
          traits: [
            { name: "Sturdy", known: true, researching: false },
            { name: "Divines", known: false, researching: false },
          ],
        },
      ],
    },
  ],
};

const motifs: MotifStyle[] = [
  {
    name: "Crafting Motif 1: Breton",
    known: 14,
    total: 14,
    chapters: [
      { name: "Axes", known: true },
      { name: "Belts", known: true },
    ],
  },
  { name: "Dwemer Style", known: 3, total: 14, chapters: [] },
];

const recipes: RecipeList[] = [
  {
    name: "Meat Dishes",
    kind: "provisioning",
    known: 2,
    total: 3,
    recipes: [
      { name: "Chicken Breast", known: true, quality: 1 },
      { name: "Beef Stew", known: true, quality: 2 },
      { name: "Solitude Salmon Millet Soup", known: false, quality: 4 },
    ],
  },
  {
    name: "Blueprints",
    kind: "furnishing",
    known: 1,
    total: 2,
    recipes: [
      { name: "Common Table", known: true },
      { name: "Regal Chair", known: false },
    ],
  },
];

const styles: OutfitStyleCategory[] = [
  {
    name: "Hats",
    groups: [
      {
        name: "Breton",
        styles: [
          { collectibleId: 1, name: "Breton Hat", unlocked: true, itemStyleId: 1 },
          { collectibleId: 2, name: "Breton Hood", unlocked: false, itemStyleId: 1 },
        ],
      },
    ],
  },
];

describe("knowledge present", () => {
  it("normalizes motif names so lore books match outfit style groups", () => {
    assert.equal(motifKey("Crafting Motif 15: Dwemer Style"), motifKey("Dwemer"));
    assert.equal(motifKey("Crafting Motif 1: High Elf"), motifKey("High Elf Style"));
    assert.equal(motifKey("Breton"), "breton");
  });

  it("formats research remaining as of last logout, without ticking", () => {
    assert.equal(formatResearchRemaining(26 * 3600), "1d 2h");
    assert.equal(formatResearchRemaining(90 * 60), "1h 30m");
    assert.equal(formatResearchRemaining(45), "45s");
  });

  it("builds the 324-style research grid and derives in-progress rows", () => {
    const presented = presentResearch(research);
    assert.equal(presented.known, 2);
    assert.equal(presented.total, 4);
    assert.equal(presented.inProgress.length, 1);
    assert.equal(presented.inProgress[0].trait, "Nirnhoned");
    assert.equal(presented.inProgress[0].line, "Axe");
    assert.equal(presented.crafts[0].groups.length, 2, "weapon and armor traits stay in separate tables");
  });

  it("drops the old in-progress stub array instead of treating it as a grid", () => {
    const presented = presentResearch([{ craft: "Blacksmithing", trait: "Nirnhoned", remaining: "12d" }]);
    assert.equal(presented.total, 0);
    assert.equal(presented.inProgress.length, 0);
  });

  it("splits recipes from furnishing plans and does not invent scribing rows", () => {
    const food = presentRecipeLists(recipes, "provisioning");
    const plans = presentRecipeLists(recipes, "furnishing");
    assert.equal(food.known, 2);
    assert.equal(food.total, 3);
    assert.equal(plans.lists[0].name, "Blueprints");
    assert.equal(presentMotifs(motifs).known, 17);
    assert.equal(presentMotifs(motifs).total, 28);
  });

  it("summarizes account knowledge and flags a missing logout scan", () => {
    const scanned = char({ id: "a", name: "Sings", research, motifs, recipeLists: recipes });
    const stub = char({ id: "b", name: "Alt", lastSeen: null });
    assert.equal(characterHasKnowledgeScan(scanned), true);
    assert.equal(characterHasKnowledgeScan(stub), false);
    const summary = summarizeAccountKnowledge([scanned, stub]);
    assert.equal(summary.scanned, 1);
    assert.equal(summary.total, 2);
    assert.equal(summary.researchKnown, 2);
    assert.equal(summary.recipeKnown, 2);
    assert.equal(summary.planKnown, 1);
  });

  it("presents outfit styles as the game tree and counts unlocks", () => {
    const presented = presentOutfitStyles(styles);
    assert.equal(presented.unlocked, 1);
    assert.equal(presented.total, 2);
    assert.equal(presented.categories[0].groups[0].motifKey, "breton");
    assert.equal(accountHasOutfitStylesScan(styles), true);
    assert.equal(accountHasOutfitStylesScan([]), false);
  });
});
