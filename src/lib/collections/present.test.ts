import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { collectionsSummaryLine, presentCollections } from "./present";
import type { House, OutfitStyleCategory, StickerbookSet } from "../snapshot/schema";

describe("presentCollections", () => {
  it("defaults to sets when stickerbook has pieces", () => {
    const stickerbook: StickerbookSet[] = [
      {
        name: "Trial Set",
        setId: 1,
        category: "Trials",
        subcategory: null,
        categoryOrder: 0,
        subOrder: 0,
        pieces: [
          { slot: "Head", type: "Heavy Head", weight: "Heavy", name: "Helm", icon: null, collected: true },
          { slot: "Chest", type: "Heavy Chest", weight: "Heavy", name: "Cuirass", icon: null, collected: false },
        ],
      },
    ];
    const present = presentCollections({
      stickerbook,
      outfitStyles: [],
      houses: [],
    });
    assert.equal(present.defaultTab, "sets");
    assert.equal(present.sets.total, 2);
    assert.equal(present.sets.collected, 1);
    assert.equal(present.sets.pct, 50);
  });

  it("falls through to styles then houses for defaultTab", () => {
    const styles: OutfitStyleCategory[] = [
      {
        name: "Hats",
        groups: [
          {
            name: "Breton",
            styles: [{ name: "Breton Hat", unlocked: true, icon: null, collectibleId: 1, itemStyleId: null }],
          },
        ],
      },
    ];
    const withStyles = presentCollections({ stickerbook: [], outfitStyles: styles, houses: [] });
    assert.equal(withStyles.defaultTab, "styles");

    const houses: House[] = [
      { collectibleId: 9, name: "Snugpod", location: "Grahtwood", icon: null, primary: true },
    ];
    const withHouses = presentCollections({ stickerbook: [], outfitStyles: [], houses });
    assert.equal(withHouses.defaultTab, "houses");
    assert.equal(withHouses.houses.primary?.name, "Snugpod");
    assert.match(collectionsSummaryLine(withHouses), /1 houses/);
  });
});
