import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canonicalizeCurrencies, characterWalletBreakdown, dashboardWallet, walletEntries } from "./currencies";

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

  it("lists gold, Tel Var, and every account currency on the home dashboard", () => {
    const rows = dashboardWallet({
      gold: 4218764,
      telVar: 15230,
      currencies: { alliancePoints: 402118, writVouchers: 0 },
    });
    assert.equal(rows[0]?.key, "gold");
    assert.equal(rows[0]?.amount, 4218764);
    assert.equal(rows[1]?.key, "telVar");
    assert.ok(rows.some((r) => r.key === "crowns" && r.amount === 0));
    assert.ok(rows.some((r) => r.key === "alliancePoints" && r.amount === 402118));
    assert.ok(rows.some((r) => r.key === "writVouchers" && r.amount === 0));
    assert.equal(
      rows.some((r) => r.key === "bankGold"),
      false,
    );
  });

  it("folds singular leftover keys into the stable wallet rows", () => {
    const rows = dashboardWallet({
      gold: 1,
      telVar: 2,
      currencies: {
        alliancePoints: 0,
        alliancePoint: 0,
        crowns: 2295,
        crown: 2295,
        tradeBars: 11606,
        tradeBar: 11606,
        premiumTomeTokens: 0,
        premiumTomeToken: 10,
        undauntedCrest: 0,
        challengeReroll: 12,
        transmuteCrystals: 506,
        transmuteCrystal: 506,
      },
    });
    const keys = rows.map((r) => r.key);
    assert.equal(keys.filter((k) => k === "crowns" || k === "crown").length, 1);
    assert.equal(rows.find((r) => r.key === "crowns")?.amount, 2295);
    assert.equal(rows.find((r) => r.key === "tradeBars")?.amount, 11606);
    assert.equal(rows.find((r) => r.key === "premiumTomeTokens")?.amount, 10);
    assert.equal(rows.find((r) => r.key === "transmuteCrystals")?.amount, 506);
    assert.equal(
      keys.some((k) => k === "crown" || k === "tradeBar" || k === "premiumTomeToken" || k === "transmuteCrystal"),
      false,
    );
    assert.ok(rows.some((r) => r.key === "challengeReroll" && r.amount === 12));
    assert.ok(rows.some((r) => r.key === "undauntedCrest" && r.amount === 0));
  });

  it("canonicalizes a live snapshot that wrote both plural and singular keys", () => {
    const folded = canonicalizeCurrencies({
      crowns: 2295,
      crown: 2295,
      seal: 15575,
      seals: 15575,
      archivalFortune: 8010,
      archivalFortunes: 8010,
    });
    assert.equal(folded.crowns, 2295);
    assert.equal(folded.seals, 15575);
    assert.equal(folded.archivalFortunes, 8010);
    assert.equal("crown" in folded, false);
    assert.equal("seal" in folded, false);
    assert.equal("archivalFortune" in folded, false);
  });

  it("builds a per-character hover list and keeps bank last", () => {
    const rows = characterWalletBreakdown(
      [
        { name: "B", lastSeen: 1, gold: 10 },
        { name: "A", lastSeen: 1, gold: 50 },
        { name: "C", lastSeen: null, gold: 0 },
      ],
      "gold",
      [{ name: "Bank", amount: 500 }],
    );
    assert.deepEqual(
      rows.map((r) => r.name),
      ["A", "B", "C", "Bank"],
    );
    assert.equal(rows[0]?.amount, 50);
    assert.equal(rows[2]?.amount, null);
    assert.equal(rows[3]?.amount, 500);

    const wallet = dashboardWallet({
      gold: 1,
      telVar: 2,
      currencies: { alliancePoints: 3 },
      breakdowns: { gold: rows, alliancePoints: [{ name: "A", amount: 3 }] },
    });
    assert.equal(wallet.find((r) => r.key === "gold")?.breakdown?.length, 4);
    assert.equal(wallet.find((r) => r.key === "alliancePoints")?.breakdown?.[0]?.amount, 3);
    assert.match(wallet.find((r) => r.key === "crowns")?.sharedNote ?? "", /Account-wide/);
  });
});
