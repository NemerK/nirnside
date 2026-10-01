import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { walletEntries } from "./currencies";

describe("walletEntries", () => {
  it("keeps in-game order and always shows AP / transmutes / keys / writs", () => {
    const rows = walletEntries({
      writVouchers: 6640,
      alliancePoints: 402118,
      transmuteCrystals: 812,
      undauntedKeys: 21,
      eventTickets: 0,
      crowns: 0,
    });
    assert.deepEqual(
      rows.map((r) => r.key),
      ["alliancePoints", "transmuteCrystals", "undauntedKeys", "writVouchers"],
    );
    assert.equal(rows[0].amount, 402118);
  });

  it("hides bankGold and telVar (those belong on the character table)", () => {
    const rows = walletEntries({
      bankGold: 500000,
      telVar: 15230,
      alliancePoints: 1,
      transmuteCrystals: 0,
      undauntedKeys: 0,
      writVouchers: 0,
    });
    assert.equal(
      rows.some((r) => r.key === "bankGold" || r.key === "telVar"),
      false,
    );
  });

  it("appends unknown live-patch currencies instead of dropping them", () => {
    const rows = walletEntries({
      alliancePoints: 0,
      transmuteCrystals: 0,
      undauntedKeys: 0,
      writVouchers: 0,
      mysteryTokens: 42,
    });
    const extra = rows.find((r) => r.key === "mysteryTokens");
    assert.ok(extra);
    assert.equal(extra?.label, "Mystery Tokens");
    assert.equal(extra?.amount, 42);
  });

  it("can include zeros when asked", () => {
    const rows = walletEntries({ alliancePoints: 0, transmuteCrystals: 0 }, { includeZero: true });
    assert.ok(rows.some((r) => r.key === "crowns" && r.amount === 0));
    assert.ok(rows.some((r) => r.key === "alliancePoints"));
  });
});
