import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  briefsForHover,
  indexKnownSets,
  overlayScannedBonuses,
  inferSetName,
  lookupSetBrief,
  resolveItemSet,
  type AccountSetFacts,
  type SetBrief,
} from "./set-brief";

const sets: SetBrief[] = [
  {
    id: "set-pale-order",
    name: "Ring of the Pale Order",
    setId: 574,
    category: "Mythic",
    maxEquip: 1,
    source: "reference",
    bonuses: [{ pieces: 1, text: "Heal for a percentage of your damage done." }],
  },
  {
    id: "set-coral",
    name: "Coral Riptide",
    setId: 693,
    category: "Trial",
    maxEquip: 5,
    source: "reference",
    bonuses: [{ pieces: 5, text: "Increases damage." }],
  },
  {
    id: "set-orders",
    name: "Order's Wrath",
    setId: 583000,
    category: "Crafted",
    maxEquip: 5,
    source: "reference",
    bonuses: [],
  },
  {
    id: "set-slimecraw",
    name: "Slimecraw",
    setId: 154,
    category: "Monster Set",
    maxEquip: 2,
    source: "reference",
    bonuses: [],
  },
  {
    id: "set-sul-xans-torment",
    name: "Sul-Xan's Torment",
    setId: 660,
    category: "Trial",
    maxEquip: 5,
    source: "reference",
    bonuses: [],
  },
];

describe("lookupSetBrief", () => {
  it("matches a worn mythic name and a set id to the catalog entry", () => {
    assert.equal(lookupSetBrief(sets, { name: "Pale Order" })?.id, "set-pale-order");
    assert.equal(lookupSetBrief(sets, { name: "Coral Riptide" })?.id, "set-coral");
    assert.equal(lookupSetBrief(sets, { setId: 574, name: "anything" })?.name, "Ring of the Pale Order");
  });

  it("does not borrow a different set that merely shares a word", () => {
    assert.equal(lookupSetBrief(sets, { name: "Order's Wrath" })?.id, "set-orders");
    assert.equal(lookupSetBrief(sets, { name: "Unknown Set" }), null);
  });

  it("reads the set out of a piece name when the snapshot stored none", () => {
    assert.equal(inferSetName("Aetheric Lancer Bracers"), "Aetheric Lancer");
    assert.equal(inferSetName("Aetheric Lancer Jack"), "Aetheric Lancer");
    assert.equal(inferSetName("Aetheric Lancer Guards"), "Aetheric Lancer");
    assert.equal(inferSetName("Velothi Ur-Mage's Amulet"), "Velothi Ur-Mage");
    assert.equal(inferSetName("Slimecraw's Helm"), "Slimecraw");
    assert.equal(inferSetName("Perfected Helmet of Sul-Xan's Torment"), "Sul-Xan's Torment");
    assert.equal(inferSetName("Perfected Dagger of Sul-Xan's Torment"), "Sul-Xan's Torment");
    assert.equal(inferSetName("Crown Repair Kit"), null);
    assert.equal(inferSetName("Bewitched Sugar Skulls"), null);
    assert.equal(lookupSetBrief(sets, { itemName: "Slimecraw's Helm" })?.id, "set-slimecraw");
    assert.equal(
      lookupSetBrief(sets, { itemName: "Perfected Helmet of Sul-Xan's Torment" })?.id,
      "set-sul-xans-torment",
    );
    assert.equal(lookupSetBrief(sets, { itemName: "Ring of the Pale Order" })?.id, "set-pale-order");
    assert.equal(lookupSetBrief(sets, { itemName: "Aetheric Lancer Bracers" }), null);
  });
});

function manySets(extra: { name: string; setId?: number }[]): ReturnType<typeof indexKnownSets> {
  const filler = Array.from({ length: 45 }, (_, index) => ({
    name: `Filler Set ${index + 1}`,
    setId: 1000 + index,
  }));
  return indexKnownSets([...extra, ...filler]);
}

describe("resolveItemSet", () => {
  const known = manySets([
    { name: "Aetheric Lancer", setId: 11 },
    { name: "Sul-Xan's Torment", setId: 660 },
    { name: "Slimecraw", setId: 154 },
    { name: "Velothi Ur-Mage's Amulet", setId: 20 },
    { name: "Ring of the Pale Order", setId: 574 },
    { name: "Oakensoul Ring", setId: 21 },
    { name: "Thrassian Stranglers", setId: 22 },
    { name: "Spaulder of Ruin", setId: 583 },
    { name: "Harpooner's Wading Kilt", setId: 23 },
    { name: "Mother's Sorrow", setId: 209 },
    { name: "Arms of Relequen", setId: 24 },
    { name: "Order's Wrath", setId: 25 },
    { name: "Selene", setId: 26 },
    { name: "Night Mother", setId: 27 },
    { name: "Night Mother's Gaze", setId: 28 },
    { name: "Oakensoul", setId: 29 },
  ]);

  it("associates every set-name shape, including names that are the whole item", () => {
    assert.equal(resolveItemSet({ name: "Aetheric Lancer Bracers" }, known).name, "Aetheric Lancer");
    assert.equal(resolveItemSet({ name: "Aetheric Lancer Jack" }, known).setId, 11);
    assert.equal(resolveItemSet({ name: "Aetheric Lancer Guards" }, known).name, "Aetheric Lancer");
    assert.equal(resolveItemSet({ name: "Order's Wrath Girdle" }, known).name, "Order's Wrath");
    assert.equal(resolveItemSet({ name: "Selene's Mask" }, known).name, "Selene");
    assert.equal(resolveItemSet({ name: "Slimecraw Epaulets" }, known).name, "Slimecraw");
    assert.equal(resolveItemSet({ name: "Slimecraw's Helm" }, known).setId, 154);
    assert.equal(resolveItemSet({ name: "Perfected Helmet of Sul-Xan's Torment" }, known).name, "Sul-Xan's Torment");
    assert.equal(resolveItemSet({ name: "Perfected Dagger of Sul-Xan's Torment" }, known).setId, 660);
    assert.equal(resolveItemSet({ name: "Perfected Ring of Sul-Xan's Torment" }, known).name, "Sul-Xan's Torment");
    assert.equal(resolveItemSet({ name: "Mother's Sorrow Robe" }, known).name, "Mother's Sorrow");
    assert.equal(resolveItemSet({ name: "Inferno Staff of Mother's Sorrow" }, known).setId, 209);
    assert.equal(resolveItemSet({ name: "Necklace of Arms of Relequen" }, known).name, "Arms of Relequen");
    assert.equal(resolveItemSet({ name: "Ring of the Pale Order" }, known).name, "Ring of the Pale Order");
    assert.equal(resolveItemSet({ name: "Oakensoul Ring" }, known).name, "Oakensoul Ring");
    assert.equal(resolveItemSet({ name: "Thrassian Stranglers" }, known).setId, 22);
    assert.equal(resolveItemSet({ name: "Spaulder of Ruin" }, known).name, "Spaulder of Ruin");
    assert.equal(resolveItemSet({ name: "Harpooner's Wading Kilt" }, known).name, "Harpooner's Wading Kilt");
    assert.equal(resolveItemSet({ name: "Velothi Ur-Mage's Amulet" }, known).setId, 20);
    assert.equal(resolveItemSet({ name: "Night Mother's Gaze Helmet" }, known).name, "Night Mother's Gaze");
    assert.equal(
      resolveItemSet({ name: "Perfected Helmet of Sul-Xan\u2019s Torment" }, known).name,
      "Sul-Xan's Torment",
    );
  });

  it("does not call a material, a food, or a kit a set once the stickerbook is known", () => {
    assert.equal(resolveItemSet({ name: "Rubedite Dagger" }, known).name, null);
    assert.equal(resolveItemSet({ name: "Crown Repair Kit" }, known).name, null);
    assert.equal(resolveItemSet({ name: "Bewitched Sugar Skulls" }, known).name, null);
  });

  it("keeps a stored set name and still guesses when almost no sets are known", () => {
    assert.equal(
      resolveItemSet({ name: "Aetheric Lancer Bracers", setName: "Order's Wrath" }, known).name,
      "Order's Wrath",
    );
    const tiny = indexKnownSets([{ name: "Coral Riptide", setId: 693 }]);
    assert.equal(resolveItemSet({ name: "Aetheric Lancer Bracers" }, tiny).name, "Aetheric Lancer");
    assert.equal(resolveItemSet({ name: "Crown Repair Kit" }, tiny).name, null);
  });
});

describe("briefsForHover", () => {
  it("adds every account set and lets in-game lines replace reference text", () => {
    const account: AccountSetFacts[] = [
      {
        name: "Aetheric Lancer",
        setId: 11,
        category: "Dungeons",
        maxEquip: 5,
        bonuses: [{ pieces: 2, text: "Adds Critical Chance." }],
      },
      {
        name: "Slimecraw",
        setId: 154,
        category: "Dungeons",
        maxEquip: 2,
        bonuses: [{ pieces: 1, text: "Adds Critical Chance from the game." }],
      },
      {
        name: "Sul-Xan's Torment",
        setId: 660,
        category: "Trials",
        maxEquip: 5,
        bonuses: [],
      },
    ];
    const reference: SetBrief[] = sets.map((set) =>
      set.id === "set-sul-xans-torment"
        ? { ...set, source: "reference", bonuses: [{ pieces: 5, text: "Reference line." }] }
        : set,
    );
    const briefs = briefsForHover(reference, account);
    const aetheric = briefs.find((set) => set.name === "Aetheric Lancer");
    assert.equal(aetheric?.source, "ingame");
    assert.equal(aetheric?.bonuses[0]?.text, "Adds Critical Chance.");
    assert.equal(aetheric?.category, "Dungeons");
    const slimecraw = briefs.filter((set) => set.setId === 154);
    assert.equal(slimecraw.length, 1);
    assert.equal(slimecraw[0]?.bonuses[0]?.text, "Adds Critical Chance from the game.");
    assert.equal(slimecraw[0]?.source, "ingame");
    const sul = briefs.find((set) => set.id === "set-sul-xans-torment");
    assert.equal(sul?.bonuses[0]?.text, "Reference line.");
    assert.equal(sul?.source, "reference");
  });
});

describe("overlayScannedBonuses", () => {
  const nullArca: AccountSetFacts = {
    name: "Perfected Slivers of the Null Arca",
    setId: 900,
    category: "Trial",
    maxEquip: 5,
    bonuses: [
      { pieces: 2, text: "Adds |cffffff634|r Critical Chance" },
      { pieces: 5, text: "Adds |cffffff124|r Weapon and Spell Damage" },
    ],
  };

  it("fills an empty in-game catalog row from the stickerbook scan", () => {
    const view = overlayScannedBonuses(
      { name: nullArca.name, setId: 900, bonuses: [] },
      "ingame",
      [nullArca],
    );
    assert.equal(view.source, "ingame");
    assert.equal(view.bonuses.length, 2);
    assert.equal(view.bonuses[0]?.text, "Adds |cffffff634|r Critical Chance");
  });

  it("replaces a reference paraphrase with the scanned lines", () => {
    const view = overlayScannedBonuses(
      { name: "Slimecraw", setId: 154, bonuses: [{ pieces: 1, text: "Adds Critical Chance." }] },
      "reference",
      [
        {
          name: "Slimecraw",
          setId: 154,
          category: "Dungeons",
          maxEquip: 2,
          bonuses: [{ pieces: 1, text: "Adds |cffffff1096|r Critical Chance." }],
        },
      ],
    );
    assert.equal(view.source, "ingame");
    assert.equal(view.bonuses[0]?.text, "Adds |cffffff1096|r Critical Chance.");
  });

  it("keeps in-game catalog lines that are already present", () => {
    const view = overlayScannedBonuses(
      { name: "Slimecraw", setId: 154, bonuses: [{ pieces: 1, text: "Catalog line." }] },
      "ingame",
      [
        {
          name: "Slimecraw",
          setId: 154,
          category: "Dungeons",
          maxEquip: 2,
          bonuses: [{ pieces: 1, text: "Account line." }],
        },
      ],
    );
    assert.equal(view.bonuses[0]?.text, "Catalog line.");
    assert.equal(view.source, "ingame");
  });

  it("leaves the catalog empty when the scan stored no lines", () => {
    const view = overlayScannedBonuses({ name: "Coral Riptide", setId: 693, bonuses: [] }, "ingame", [
      { name: "Coral Riptide", setId: 693, category: "Trial", maxEquip: 5, bonuses: [] },
    ]);
    assert.equal(view.bonuses.length, 0);
    assert.equal(view.source, "ingame");
  });

  it("matches a perfected name when the catalog has no set id", () => {
    const view = overlayScannedBonuses({ name: nullArca.name, setId: null, bonuses: [] }, "reference", [
      {
        name: "Slivers of the Null Arca",
        setId: 12,
        category: "Trial",
        maxEquip: 5,
        bonuses: [{ pieces: 5, text: "Base line." }],
      },
      nullArca,
    ]);
    assert.equal(view.bonuses[0]?.text, "Adds |cffffff634|r Critical Chance");
    assert.equal(view.source, "ingame");
  });

  it("uses a same-name scan when the set id row has no lines", () => {
    const view = overlayScannedBonuses({ name: nullArca.name, setId: 900, bonuses: [] }, "ingame", [
      { ...nullArca, setId: 900, bonuses: [] },
      { ...nullArca, setId: 901 },
    ]);
    assert.equal(view.bonuses[0]?.text, "Adds |cffffff634|r Critical Chance");
  });

  it("does not invent lines when the account has no matching set", () => {
    const view = overlayScannedBonuses({ name: "Missing Set", setId: 1, bonuses: [] }, "ingame", []);
    assert.deepEqual(view.bonuses, []);
    assert.equal(view.source, "ingame");
  });
});
