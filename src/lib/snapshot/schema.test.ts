import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AccountSnapshot } from "./schema";
import { loadSnapshotFromLua } from "./load";

describe("account snapshot resilience", () => {
  it("keeps the account when an odd scalar/record value is present", () => {
    // A real snapshot with values the strict schema would once have rejected
    // outright (negative/float currency amount, a stray non-number achievement
    // id, an odd apiVersion). None of these must blank the whole account.
    const parsed = AccountSnapshot.safeParse({
      displayName: "@Nemer",
      apiVersion: 1.5,
      gold: -10,
      currencies: { telVar: -5, transmuteCrystals: 3.7, alliancePoints: 800 },
      achievements: ["Vanquisher", 12345],
      completedAchievementIds: "not-an-array",
      characters: [{ id: "char-1", name: "Ardent", class: "Dragonknight", race: "Nord", alliance: "Ebonheart Pact" }],
    });
    assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error?.format()));
    if (!parsed.success) return;
    // The real payload — the characters — survives.
    assert.equal(parsed.data.characters.length, 1);
    assert.equal(parsed.data.characters[0].name, "Ardent");
    // Bad account-level values degrade to safe defaults, never throw.
    assert.equal(parsed.data.displayName, "@Nemer");
    assert.equal(parsed.data.currencies.alliancePoints, 800);
    assert.deepEqual(parsed.data.completedAchievementIds, []);
  });

  it("backfills a missing account name from the SavedVariables key", () => {
    const lua = `
      NirnsideData = {
        ["Default"] = {
          ["@AzuraStar"] = {
            ["$AccountWide"] = {
              ["characters"] = {
                { ["id"] = "c1", ["name"] = "Sings", ["class"] = "Nightblade", ["race"] = "Khajiit", ["alliance"] = "Aldmeri Dominion" },
              },
            },
          },
        },
      }
    `;
    const snap = loadSnapshotFromLua(lua);
    assert.equal(snap.displayName, "@AzuraStar");
    assert.equal(snap.characters.length, 1);
  });
});
