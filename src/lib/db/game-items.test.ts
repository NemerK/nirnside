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
  it("learns from a scan and keeps what later scans no longer hold", () => {
    const first = idx.itemsFromSnapshot({
      items: [{ itemId: 1, name: "Helm of Order", equipSlot: "Heavy Head", setId: 7, setName: "Order's Wrath" }],
      characters: [
        { equipped: [{ itemId: 2, slot: "Ring 1", name: "Ring of Order", setId: 7, setName: "Order's Wrath" }] },
      ],
      archivedCharacters: [],
      stickerbook: [
        { setId: 7, name: "Order's Wrath", pieces: [{ itemId: 1, type: "Heavy Head", name: "Helm of Order", icon: "/i.dds" }] },
      ],
    } as never);
    db.learnItems(first, 100);
    const helm = db.getLearnedItem(1)!;
    assert.equal(helm.kind, "heavy-head");
    assert.equal(helm.icon, "/i.dds");
    assert.deepEqual(helm.seenIn.sort(), ["bag", "collection"]);
    assert.equal(db.getLearnedItem(2)!.kind, "ring");

    // A later scan without the ring: the ring is still known; the helm gets a new sighting.
    db.learnItems(
      idx.itemsFromSnapshot({
        items: [],
        characters: [{ equipped: [{ itemId: 1, slot: "Head", name: "Helm of Order", setId: 7 }] }],
        archivedCharacters: [],
        stickerbook: [],
      } as never),
      200,
    );
    assert.ok(db.getLearnedItem(2));
    const again = db.getLearnedItem(1)!;
    assert.deepEqual(again.seenIn.sort(), ["bag", "collection", "worn"]);
    assert.equal(again.firstSeen, 100);
    assert.equal(again.lastSeen, 200);
    assert.equal(db.learnedItemsForSet(7).length, 2);
  });
});
