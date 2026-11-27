import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

process.env.NIRNSIDE_DB = join(tmpdir(), `nirnside-items-test-${process.pid}.db`);

type Mod = typeof import("./game-items");
type Idx = typeof import("../game/item-index");
let db: Mod;
let idx: Idx;

before(async () => {
  db = await import("./game-items");
  idx = await import("../game/item-index");
});

describe("item index", () => {
  it("holds what the account holds now, filed where the game files it", () => {
    const first = idx.itemsFromSnapshot({
      items: [
        { itemId: 1, name: "Helm of Order", equipSlot: "Heavy Head", setId: 7, setName: "Order's Wrath" },
        {
          itemId: 3,
          name: "Ghastly Eye Bowl",
          bagCategory: "consumables",
          bagSubtype: "food",
          itemTypeLabel: "Food",
        },
      ],
      characters: [
        { equipped: [{ itemId: 2, slot: "Ring 1", name: "Ring of Order", setId: 7, setName: "Order's Wrath" }] },
      ],
      archivedCharacters: [],
      stickerbook: [
        { setId: 7, name: "Order's Wrath", pieces: [{ itemId: 1, type: "Heavy Head", name: "Helm of Order", icon: "/i.dds" }] },
      ],
    } as never);
    db.syncItems(first, 100);
    const helm = db.getLearnedItem(1)!;
    assert.equal(helm.kind, "heavy-head");
    assert.equal(helm.icon, "/i.dds");
    assert.deepEqual(helm.seenIn.sort(), ["bag", "collection"]);
    assert.deepEqual([helm.category, helm.subtype, helm.placeFrom], ["apparel", "heavy", "piece"]);
    assert.equal(db.getLearnedItem(2)!.kind, "ring");
    const bowl = db.getLearnedItem(3)!;
    assert.deepEqual([bowl.category, bowl.subtype, bowl.typeLabel, bowl.placeFrom], ["consumables", "food", "Food", "game"]);

    // A later scan: the ring and the bowl were sold, the helm is now worn and still in the collection.
    const later = db.syncItems(
      idx.itemsFromSnapshot({
        items: [],
        characters: [{ equipped: [{ itemId: 1, slot: "Head", name: "Helm of Order", setId: 7 }] }],
        archivedCharacters: [],
        stickerbook: [
          { setId: 7, name: "Order's Wrath", pieces: [{ itemId: 1, type: "Heavy Head", name: "Helm of Order" }] },
        ],
      } as never),
      200,
    );
    assert.equal(later.dropped, 2);
    assert.equal(db.getLearnedItem(2), null);
    assert.equal(db.getLearnedItem(3), null);
    const again = db.getLearnedItem(1)!;
    assert.deepEqual(again.seenIn.sort(), ["collection", "worn"]);
    assert.equal(again.firstSeen, 100);
    assert.equal(again.lastSeen, 200);
    assert.equal(db.learnedItemsForSet(7).length, 1);
  });

  it("ignores an empty scan rather than wiping the index", () => {
    assert.deepEqual(db.syncItems([], 300), { kept: 0, dropped: 0 });
    assert.ok(db.getLearnedItem(1));
  });
});

describe("filing bag items", () => {
  it("keeps the game's tab and files untagged gear by its piece", () => {
    assert.equal(idx.fileItem({ name: "x", bagCategory: "consumables", bagSubtype: "food", equipSlot: null }).bagCategory, "consumables");
    const helm = idx.fileItem({ name: "Helm of the Pariah", equipSlot: null, bagCategory: null, bagSubtype: null });
    assert.deepEqual([helm.bagCategory, helm.bagSubtype], ["apparel", "heavy"]);
    const oil = idx.fileItem({ name: "Dwarven Oil", equipSlot: null, bagCategory: null, bagSubtype: null });
    assert.equal(oil.bagCategory, null);
  });
});
