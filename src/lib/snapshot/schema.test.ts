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
    assert.equal(parsed.data.characters[0].dailies?.zoneDailiesKnown, false);
    assert.deepEqual(parsed.data.characters[0].dailies?.zoneDailies, []);
  });

  it("keeps the research grid, motifs, recipes, and outfit styles", () => {
    const parsed = AccountSnapshot.safeParse({
      displayName: "@Nemer",
      outfitStyles: [
        {
          name: "Hats",
          groups: [
            {
              name: "Breton",
              styles: [{ collectibleId: 11, name: "Breton Hat", unlocked: true, itemStyleId: 1 }],
            },
          ],
        },
        { groups: [{ name: "no-id", styles: [{ name: "Nope" }] }] },
      ],
      characters: [
        {
          id: "c1",
          name: "Ardent",
          class: "Dragonknight",
          race: "Nord",
          alliance: "Ebonheart Pact",
          research: {
            crafts: [
              {
                craft: "blacksmithing",
                name: "Blacksmithing",
                maxSlots: 3,
                lines: [
                  {
                    name: "Axe",
                    traits: [{ name: "Nirnhoned", known: false, researching: true, remainingSeconds: 100 }],
                  },
                ],
              },
            ],
          },
          motifs: [{ name: "Breton", known: 14, total: 14, chapters: [{ name: "Axes", known: true }] }],
          recipeLists: [
            { name: "Meat Dishes", kind: "provisioning", known: 1, total: 1, recipes: [{ name: "Chicken Breast", known: true }] },
            { name: "skip-me", kind: "nope" },
          ],
        },
      ],
    });
    assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error?.format()));
    if (!parsed.success) return;
    assert.equal(parsed.data.outfitStyles.length, 1);
    assert.equal(parsed.data.outfitStyles[0].groups[0].styles[0].name, "Breton Hat");
    assert.equal(parsed.data.characters[0].research.crafts[0].lines[0].traits[0].researching, true);
    assert.equal(parsed.data.characters[0].motifs[0].known, 14);
    assert.equal(parsed.data.characters[0].recipeLists.length, 1);
  });

  it("drops the old research stub array instead of rejecting the character", () => {
    const parsed = AccountSnapshot.safeParse({
      displayName: "@Nemer",
      characters: [
        {
          id: "c1",
          name: "Ardent",
          class: "Dragonknight",
          race: "Nord",
          alliance: "Ebonheart Pact",
          research: [{ craft: "Blacksmithing", trait: "Nirnhoned", remaining: "12d" }],
        },
      ],
    });
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.deepEqual(parsed.data.characters[0].research, { crafts: [] });
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

describe("values (snapshot 0.9.46)", () => {
  it("reads stats, bars, effect amounts, star bonuses and item values, and still reads saves without them", async () => {
    const { Character, Item, EquippedItem } = await import("./schema");
    const base = { id: "1", name: "Test", class: "Sorcerer", race: "Breton", alliance: "Daggerfall Covenant" };
    const c = Character.parse({
      ...base,
      stats: {
        main: [{ key: "magicka_max", stat: 7, label: "Maximum Magicka", value: 38215 }],
        advanced: [{ category: "Combat", key: "critical_damage", stat: 22, label: "Critical Damage", format: "percent", percent: 71.5 }],
      },
      bars: [{ bar: "front", skills: [{ slot: 6, ultimate: true, abilityId: 23634, name: "Summon Charged Atronach", description: "Deals 1000 Shock Damage." }] }],
      buffs: [{ name: "Boon: The Shadow", mundus: true, effects: [{ advanced: true, key: "critical_damage", stat: 22, value: 11, format: "percent" }] }],
      champion: [{ name: "Warfare", stars: [{ name: "Deadly Aim", points: 50, slotted: true, bonus: "Increases damage by 10%." }] }],
    });
    assert.equal(c.stats?.main[0].value, 38215);
    assert.equal(c.bars?.[0].skills[0].ultimate, true);
    assert.equal(c.buffs?.[0].effects?.[0].value, 11);
    assert.equal(c.champion[0].stars[0].bonus, "Increases damage by 10%.");

    const old = Character.parse(base);
    assert.equal(old.stats, undefined);
    assert.equal(old.bars, undefined);

    const potion = Item.parse({ itemId: 1, name: "Essence of Spell Power", location: "backpack", value: 12, use: ["Restore 4000 Magicka."] });
    assert.deepEqual(potion.use, ["Restore 4000 Magicka."]);
    const helm = EquippedItem.parse({ slot: "Head", name: "Helm", armor: 1396, traitText: "Increases Mundus Stone effects by 9.1%.", enchant: "Adds 868 Maximum Magicka." });
    assert.equal(helm.armor, 1396);
    // An odd `use` value never blanks the item.
    assert.equal(Item.parse({ itemId: 2, name: "Odd", location: "backpack", use: "text" }).use, undefined);
  });
});
