import { test } from "node:test";
import assert from "node:assert/strict";
import { groupItems } from "./inventory";
import type { Item } from "../snapshot/schema";

const item = (over: Partial<Item>): Item => ({ name: "Repair Kit", count: 1, location: "backpack", ...over }) as Item;

test("the same item across characters and bags is one group", () => {
  const groups = groupItems([
    item({ ownerCharacter: "A", count: 12 }),
    item({ ownerCharacter: "B", count: 12 }),
    item({ ownerCharacter: "A", count: 3 }),
    item({ location: "bank", ownerCharacter: null, count: 40 }),
    item({ name: "Soul Gem", ownerCharacter: "A", count: 5 }),
  ]);
  assert.equal(groups.length, 2);
  const kit = groups[0];
  assert.equal(kit.total, 67);
  assert.equal(kit.stacks, 4);
  assert.deepEqual(
    kit.holders.map((h) => [h.owner, h.location, h.count]),
    [
      [null, "bank", 40],
      ["A", "backpack", 15],
      ["B", "backpack", 12],
    ],
  );
});

test("different traits or sets stay apart", () => {
  const groups = groupItems([
    item({ name: "Helm", setName: "Slimecraw", trait: "Divines" }),
    item({ name: "Helm", setName: "Slimecraw", trait: "Infused" }),
  ]);
  assert.equal(groups.length, 2);
});
