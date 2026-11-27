import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { blessingsFromCharacters } from "./learn";
import { readBuffs } from "./buffs";
import { readRiding } from "./riding";
import { withoutDeletedCharacters } from "../snapshot/roster";
import { AccountSnapshot, Character } from "../snapshot/schema";

const char = (over: Record<string, unknown>) =>
  Character.parse({ id: "x", name: "X", class: "Templar", race: "Breton", alliance: "Daggerfall Covenant", ...over });

describe("learning the game from saves", () => {
  it("takes Mundus text from the most recently saved character", () => {
    const boon = (description: string) => ({ name: "Boon: The Warrior", mundus: true, description });
    const rows = blessingsFromCharacters([
      char({ id: "a", lastSeen: 200, buffs: [boon("new text")] }),
      char({ id: "b", lastSeen: 100, buffs: [boon("old text"), { name: "Major Brutality" }] }),
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "mundus-the-warrior");
    assert.equal(rows[0].name, "The Warrior");
    assert.equal(rows[0].description, "new text");
  });
});

describe("deleted characters", () => {
  it("leave with their bags", () => {
    const snap = AccountSnapshot.parse({
      displayName: "@me",
      characters: [{ id: "live", name: "Kept", class: "Sorcerer", race: "Nord", alliance: "Ebonheart Pact" }],
      archivedCharacters: [
        { id: "gone", name: "Gone", class: "Sorcerer", race: "Nord", alliance: "Ebonheart Pact", archivedAt: 5 },
      ],
      items: [
        { itemId: 1, name: "A", location: "backpack", ownerCharacter: "Gone", ownerCharacterId: "gone" },
        { itemId: 2, name: "B", location: "backpack", ownerCharacter: "Gone" },
        { itemId: 3, name: "C", location: "backpack", ownerCharacter: "Kept", ownerCharacterId: "live" },
        { itemId: 4, name: "D", location: "bank" },
      ],
    });
    const { snap: out, deleted } = withoutDeletedCharacters(snap);
    assert.deepEqual(deleted.map((c) => c.id), ["gone"]);
    assert.deepEqual(out.characters.map((c) => c.id), ["live"]);
    assert.equal(out.archivedCharacters.length, 0);
    assert.deepEqual(out.items.map((i) => i.itemId), [3, 4]);
  });
});

describe("buffs and riding", () => {
  it("counts buffs down from the save", () => {
    const [food, boon] = readBuffs([{ name: "Increase Max Health", endsAt: 1000 }, { name: "Boon: The Lover", mundus: true }], 400);
    assert.equal(food.remaining, 600);
    assert.equal(boon.remaining, null);
    assert.equal(readBuffs([{ name: "x", endsAt: 100 }], 400)[0].expired, true);
  });
  it("knows when a lesson opens and when riding is done", () => {
    const r = readRiding({ speed: 40, maxSpeed: 60, stamina: 60, maxStamina: 60, capacity: 60, maxCapacity: 60, trainableAt: 500 }, 400)!;
    assert.equal(r.complete, false);
    assert.equal(r.lessonIn, 100);
    assert.equal(r.lessonReady, false);
    assert.equal(readRiding({ speed: 40, maxSpeed: 60, trainableAt: 300 }, 400)!.lessonReady, true);
    const done = readRiding({ speed: 60, maxSpeed: 60, stamina: 60, maxStamina: 60, capacity: 60, maxCapacity: 60, trainableAt: 900 }, 400)!;
    assert.equal(done.complete, true);
    assert.equal(done.lessonIn, null);
  });
});
