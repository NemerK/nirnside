import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { categoryTree, searchSets, type CollectionSet } from "./set-collection";

const set = (over: Partial<CollectionSet>): CollectionSet => ({
  setId: 1,
  name: "Set",
  category: "Dungeons",
  collected: 0,
  total: 10,
  pieces: [],
  ...over,
});

describe("categoryTree", () => {
  it("orders categories the game's way and sums zones", () => {
    const tree = categoryTree([
      set({ setId: 1, category: "Overland", categoryOrder: 2, subcategory: "Reaper's March", collected: 2 }),
      set({ setId: 2, category: "Dungeons", categoryOrder: 1 }),
      set({ setId: 3, category: "Overland", categoryOrder: 2, subcategory: "Reaper's March", collected: 3 }),
    ]);
    assert.deepEqual(tree.map((c) => c.name), ["Dungeons", "Overland"]);
    assert.equal(tree[1].subs[0].collected, 5);
    assert.equal(tree[1].sets, 2);
  });
});

describe("searchSets", () => {
  const sets = [
    set({ setId: 1, name: "Beekeeper's Gear", pieces: [{ name: "Beekeeper's Helm" }] }),
    set({ setId: 2, name: "Gear of the Bee", category: "Overland" }),
    set({ setId: 3, name: "Kagrenac’s Hope", pieces: [{ name: "Helm of Kagrenac" }] }),
  ];
  it("finds a set in any category, name matches first", () => {
    assert.deepEqual(searchSets(sets, "gear").map((s) => s.setId), [2, 1]);
  });
  it("finds a set by one of its pieces", () => {
    assert.deepEqual(searchSets(sets, "helm of").map((s) => s.setId), [3]);
  });
  it("ignores apostrophe style", () => {
    assert.deepEqual(searchSets(sets, "kagrenac's").map((s) => s.setId), [3]);
  });
});
