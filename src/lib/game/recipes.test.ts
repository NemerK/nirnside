import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CatalogRecipe } from "../catalog/schema";
import { knownRecipes, readRecipe } from "./recipes";
import { WRIT_CRAFTS } from "./writs";
import { TRADESKILLS } from "./tradeskills";

const plan = CatalogRecipe.parse({
  id: "recipe-125565",
  name: "Dwarven Pipe, Cap",
  source: "ingame",
  list: "Blacksmithing Diagrams",
  kind: "furnishing",
  craft: "blacksmithing",
  craftName: "Blacksmithing",
  requires: [{ craft: "blacksmithing", passive: "Metalworking", level: 3 }],
  ingredients: [{ itemId: 114001, name: "Dwarven Oil", quantity: 2, quality: 2 }],
  result: { itemId: 125565, name: "Dwarven Pipe, Cap", quality: 3, flavor: "A cap of Dwarven make." },
  furnishing: { category: "Structures", subcategory: "Pipes", theme: "Dwarven", limit: "Item Furnishings" },
});
const dish = CatalogRecipe.parse({
  id: "recipe-33526", name: "Grilled Hare", source: "ingame", kind: "provisioning", craft: "provisioning", qualityReq: 2,
  result: { itemId: 33526, name: "Grilled Hare", quality: 1 },
});

describe("recipes and plans", () => {
  it("words requirements as the game does", () => {
    const r = readRecipe(plan);
    assert.deepEqual(r.requirements.map((x) => x.label), ["Metalworking 3"]);
    assert.equal(r.craft, "blacksmithing");
    assert.equal(r.known, null);
    assert.deepEqual(readRecipe(dish).requirements.map((x) => x.label), ["Recipe Quality 2"]);
  });

  it("knows a recipe by its result item id, and by name on older saves", () => {
    const newer = { recipeLists: [{ name: "Blacksmithing Diagrams", kind: "furnishing" as const, known: 1, total: 1, recipes: [{ name: "Other name", known: true, resultItemId: 125565 }] }], craftLevels: { blacksmithing: 3 } };
    const r = readRecipe(plan, newer);
    assert.equal(r.known, true);
    assert.equal(r.requirements[0].met, true);
    assert.equal(r.canCraft, true);
    const older = { recipeLists: [{ name: "x", kind: "furnishing" as const, known: 1, total: 1, recipes: [{ name: "Dwarven Pipe, Cap", known: true }] }] };
    const o = readRecipe(plan, older, knownRecipes(older));
    assert.equal(o.known, true);
    assert.equal(o.requirements[0].met, null);
    assert.equal(o.canCraft, null, "levels weren't saved, so it can't be told");
  });

  it("can't be crafted when unknown or under a requirement", () => {
    const low = { recipeLists: [{ name: "x", kind: "furnishing" as const, known: 1, total: 1, recipes: [{ name: "Dwarven Pipe, Cap", known: true, resultItemId: 125565 }] }], craftLevels: { blacksmithing: 2 } };
    assert.equal(readRecipe(plan, low).canCraft, false);
    const unknown = { recipeLists: [{ name: "x", kind: "furnishing" as const, known: 0, total: 1, recipes: [{ name: "Dwarven Pipe, Cap", known: false, resultItemId: 125565 }] }], craftLevels: { blacksmithing: 9 } };
    assert.equal(readRecipe(plan, unknown).canCraft, false);
  });

  it("keeps one list of tradeskills, which the writs follow", () => {
    assert.equal(WRIT_CRAFTS, TRADESKILLS);
  });
});
