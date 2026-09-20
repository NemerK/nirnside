import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import type { Character } from "./schema";
import { loadSnapshotFromFile } from "./load";
import { accountGold, archivedCharacters, goldBreakdown, liveCharacters } from "./roster";

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
    skillLines: [],
    champion: [],
    equipped: [],
    companions: [],
    scribingScripts: [],
    research: [],
    lastSeen: 1,
    gold: 0,
    archivedAt: null,
    ...partial,
  };
}

describe("roster gold and archive", () => {
  it("keeps deleted characters out of the live roster", () => {
    const all = [
      char({ id: "a", name: "Alive", gold: 44000 }),
      char({ id: "b", name: "Gone", gold: 12, archivedAt: 99 }),
    ];
    assert.deepEqual(
      liveCharacters(all).map((c) => c.id),
      ["a"],
    );
    assert.deepEqual(
      archivedCharacters(all).map((c) => c.id),
      ["b"],
    );
  });

  it("sums live character wallets plus bank instead of last-logout gold", () => {
    const characters = [
      char({ id: "a", name: "Rich", gold: 44000 }),
      char({ id: "b", name: "Broke", gold: 0 }),
      char({ id: "c", name: "Deleted", gold: 999999, archivedAt: 1 }),
    ];
    assert.equal(accountGold({ characters, bankGold: 1000, legacyGold: 0 }), 45000);
  });

  it("falls back to legacy account gold when no per-character wallets exist yet", () => {
    const characters = [char({ id: "a", name: "Old", gold: 0 })];
    assert.equal(accountGold({ characters, bankGold: 0, legacyGold: 44000 }), 44000);
    assert.equal(goldBreakdown({ characters, bankGold: 0, legacyGold: 44000 }).usedLegacy, true);
  });

  it("reports wallet and bank parts separately for the account total", () => {
    const characters = [
      char({ id: "a", name: "Rich", gold: 44000 }),
      char({ id: "b", name: "Broke", gold: 0 }),
    ];
    assert.deepEqual(goldBreakdown({ characters, bankGold: 1000, legacyGold: 99 }), {
      wallets: 44000,
      bank: 1000,
      total: 45000,
      usedLegacy: false,
    });
  });

  it("sample snapshot sums live wallets plus bank and keeps the deleted toon in archive", () => {
    const snap = loadSnapshotFromFile(resolve("data/sample/Nirnside.lua"));
    assert.equal(liveCharacters(snap.characters).length, 3);
    assert.equal(archivedCharacters(snap.archivedCharacters).length, 1);
    assert.equal(archivedCharacters(snap.archivedCharacters)[0].name, "Whispers-of-Moon");
    assert.equal(
      accountGold({
        characters: [...snap.characters, ...snap.archivedCharacters],
        bankGold: snap.currencies.bankGold,
        legacyGold: snap.gold,
      }),
      4218764,
    );
    assert.equal(
      goldBreakdown({
        characters: [...snap.characters, ...snap.archivedCharacters],
        bankGold: snap.currencies.bankGold,
        legacyGold: snap.gold,
      }).bank,
      500000,
    );
    assert.ok(snap.items.some((it) => it.ownerCharacter === "Whispers-of-Moon"));
  });
});
