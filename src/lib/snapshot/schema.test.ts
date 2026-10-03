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

  it("rejects the addon program with a which-file hint, not a cryptic parse error", () => {
    // The file people accidentally pick: AddOns\NirnsideSnapshot\NirnsideSnapshot.lua
    const addonSource = `--[[ Nirnside Snapshot addon ]]--
local ADDON_NAME = "NirnsideSnapshot"
local function takeSnapshot() end
SLASH_COMMANDS["/nirnside"] = takeSnapshot`;
    assert.throws(
      () => loadSnapshotFromLua(addonSource),
      /SavedVariables/,
      "should point the user at the SavedVariables file",
    );
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

  it("prefers a live @account over the bundled @AzuraStar fixture in the same file", () => {
    const lua = `
      NirnsideData = {
        ["Default"] = {
          ["@AzuraStar"] = {
            ["$AccountWide"] = {
              ["displayName"] = "@AzuraStar",
              ["lastSnapshot"] = 1,
              ["characters"] = {
                { ["id"] = "c1", ["name"] = "Sings", ["class"] = "Nightblade", ["race"] = "Khajiit", ["alliance"] = "Aldmeri Dominion" },
              },
            },
          },
          ["@Jaegeron"] = {
            ["$AccountWide"] = {
              ["displayName"] = "@Jaegeron",
              ["lastSnapshot"] = 9,
              ["characters"] = {
                { ["id"] = "a", ["name"] = "One", ["class"] = "Nightblade", ["race"] = "Khajiit", ["alliance"] = "Aldmeri Dominion" },
                { ["id"] = "b", ["name"] = "Two", ["class"] = "Sorcerer", ["race"] = "High Elf", ["alliance"] = "Aldmeri Dominion" },
              },
            },
          },
        },
      }
    `;
    const snap = loadSnapshotFromLua(lua);
    assert.equal(snap.displayName, "@Jaegeron");
    assert.equal(snap.characters.length, 2);
  });

  it("keeps dailies and houses, dropping a malformed house", () => {
    const parsed = AccountSnapshot.safeParse({
      displayName: "@Nemer",
      houses: [
        { collectibleId: 1, name: "Snugpod", location: "Grahtwood", primary: true },
        { name: "missing-id" },
      ],
      characters: [
        {
          id: "c1",
          name: "Ardent",
          class: "Dragonknight",
          race: "Nord",
          alliance: "Ebonheart Pact",
          dailies: {
            dayKey: "2026-10-03",
            resetAt: 1759572000,
            capturedAt: 1759500000,
            randomNormal: { status: "done" },
            randomVeteran: { status: "available" },
            writs: [{ craft: "blacksmithing", name: "Blacksmith Writ", status: "accepted" }],
            pledges: [{ giver: "maj", giverName: "Maj al-Ragath", dungeon: "Fungal Grotto I", status: "done", hardMode: true, difficulty: "veteran" }],
          },
        },
      ],
    });
    assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error?.format()));
    if (!parsed.success) return;
    assert.equal(parsed.data.houses.length, 1);
    assert.equal(parsed.data.houses[0].name, "Snugpod");
    assert.equal(parsed.data.characters[0].dailies?.randomNormal.status, "done");
    assert.equal(parsed.data.characters[0].dailies?.writs[0].status, "accepted");
    assert.equal(parsed.data.characters[0].dailies?.pledges[0].hardMode, true);
  });

  it("drops a broken dailies block instead of the character", () => {
    const parsed = AccountSnapshot.safeParse({
      displayName: "@Nemer",
      characters: [
        {
          id: "c1",
          name: "Ardent",
          class: "Dragonknight",
          race: "Nord",
          alliance: "Ebonheart Pact",
          dailies: { randomNormal: "nope" },
        },
      ],
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.equal(parsed.data.characters.length, 1);
    assert.equal(parsed.data.characters[0].dailies, null);
  });
});
