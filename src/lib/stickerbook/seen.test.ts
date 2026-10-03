import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  annotateStickerbookSets,
  collectedPieceKeys,
  mergeSeenIds,
  shouldReseedSeen,
  stickerPieceKey,
} from "./seen";

describe("stickerbook seen marks", () => {
  it("keys a piece by set, slot, name, and type", () => {
    assert.equal(
      stickerPieceKey(42, { slot: "Head", name: "Slimecraw Helmet", type: "Medium Head" }),
      "42\tHead\tSlimecraw Helmet\tMedium Head",
    );
  });

  it("lists only collected piece keys", () => {
    const keys = collectedPieceKeys([
      {
        setId: 1,
        pieces: [
          { slot: "Head", name: "A", type: "Head", collected: true },
          { slot: "Chest", name: "B", type: "Chest", collected: false },
        ],
      },
    ]);
    assert.deepEqual(keys, ["1\tHead\tA\tHead"]);
  });

  it("reseeds when unseen or the account changes, not on the same account", () => {
    assert.equal(shouldReseedSeen(null, "@Jaegeron"), true);
    assert.equal(shouldReseedSeen({ account: "@AzuraStar", seeded: true, ids: ["x"] }, "@Jaegeron"), true);
    assert.equal(shouldReseedSeen({ account: "@Jaegeron", seeded: true, ids: ["x"] }, "@Jaegeron"), false);
  });

  it("merges newly hovered keys without duplicates", () => {
    assert.deepEqual(mergeSeenIds(["a", "b"], ["b", "c"]), ["a", "b", "c"]);
  });

  it("marks collected unseen pieces new and leaves missing pieces alone", () => {
    const rows = annotateStickerbookSets(
      [
        {
          setId: 7,
          name: "Slimecraw",
          category: "Dungeons",
          subcategory: "Fungal Grotto I",
          categoryOrder: 1,
          subOrder: 1,
          total: 2,
          collected: 1,
          pieces: [
            { slot: "Head", type: "Medium Head", weight: "Medium", name: "Slimecraw Helmet", icon: null, collected: true },
            { slot: "Shoulders", type: "Medium Shoulders", weight: "Medium", name: "Slimecraw Arm Cops", icon: null, collected: false },
          ],
        },
      ],
      new Set(),
    );
    assert.equal(rows[0]?.newCount, 1);
    assert.equal(rows[0]?.pieces[0]?.isNew, true);
    assert.equal(rows[0]?.pieces[1]?.isNew, false);

    const afterSeen = annotateStickerbookSets(rows, new Set([rows[0].pieces[0].pieceKey]));
    assert.equal(afterSeen[0]?.newCount, 0);
    assert.equal(afterSeen[0]?.pieces[0]?.isNew, false);
  });
});
