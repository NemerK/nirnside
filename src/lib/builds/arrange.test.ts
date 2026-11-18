import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { arrange, type ArrangeSet, type Crafter, type OwnedGear, type PlacedPiece } from "./arrange";
import { gearSetKey, kindFromPiece, reconstructionCost, setMatchKeys, type SlotKind } from "./slots";

const ALL: SlotKind[] = [
  "head",
  "shoulders",
  "chest",
  "hands",
  "waist",
  "legs",
  "feet",
  "neck",
  "ring",
  "oneHand",
  "twoHand",
  "shield",
];

function set(partial: Partial<ArrangeSet> & Pick<ArrangeSet, "role" | "name">): ArrangeSet {
  const pieces =
    partial.pieces ??
    (partial.role === "body" || partial.role === "front" ? 5 : partial.role === "monster" || partial.role === "back" ? 2 : 1);
  return {
    role: partial.role,
    name: partial.name,
    setId: partial.setId ?? null,
    keys: partial.keys ?? setMatchKeys(partial.name),
    pieces,
    kinds: partial.kinds ?? ALL,
    collectedKinds: partial.collectedKinds ?? [],
    collected: partial.collected ?? 0,
    total: partial.total ?? 0,
    crafted: partial.crafted ?? false,
    traitsNeeded: partial.traitsNeeded ?? null,
  };
}

function own(name: string, kind: SlotKind, trait: string, location = "bank", owner = "Faris"): OwnedGear {
  return { keys: setMatchKeys(name), setId: null, itemName: `${name} ${kind}`, kind, trait, location, owner };
}

function slot(placed: PlacedPiece[], id: string): PlacedPiece {
  const found = placed.find((piece) => piece.slot === id);
  assert.ok(found, `missing ${id}`);
  return found!;
}

const divines: Crafter[] = [
  {
    name: "Faris",
    lines: [
      { name: "Cuirass", known: 9, divines: true },
      { name: "Robe", known: 9, divines: true },
      { name: "Jack", known: 9, divines: true },
      { name: "Gauntlets", known: 9, divines: true },
      { name: "Gloves", known: 9, divines: true },
      { name: "Bracers", known: 9, divines: true },
      { name: "Girdle", known: 9, divines: true },
      { name: "Sash", known: 9, divines: true },
      { name: "Belt", known: 9, divines: true },
      { name: "Greaves", known: 9, divines: true },
      { name: "Breeches", known: 9, divines: true },
      { name: "Guards", known: 9, divines: true },
      { name: "Sabatons", known: 9, divines: true },
      { name: "Shoes", known: 9, divines: true },
      { name: "Boots", known: 9, divines: true },
      { name: "Helm", known: 9, divines: true },
      { name: "Hat", known: 9, divines: true },
      { name: "Helmet", known: 9, divines: true },
      { name: "Pauldron", known: 9, divines: true },
      { name: "Epaulets", known: 9, divines: true },
      { name: "Arm Cops", known: 9, divines: true },
      { name: "Necklace", known: 9, divines: true },
      { name: "Ring", known: 9, divines: true },
      { name: "Inferno Staff", known: 9, divines: false },
      { name: "Dagger", known: 9, divines: false },
      { name: "Bow", known: 9, divines: false },
    ],
  },
];

describe("reconstruction cost", () => {
  it("follows the game curve from 75 down to 25", () => {
    assert.equal(reconstructionCost(1, 22), 75);
    assert.equal(reconstructionCost(11, 22), 51);
    assert.equal(reconstructionCost(22, 22), 25);
    assert.equal(reconstructionCost(1, 2), 75);
    assert.equal(reconstructionCost(2, 2), 25);
    assert.equal(reconstructionCost(1, 1), 25);
    assert.equal(reconstructionCost(0, 22), null);
  });

  it("does not treat a main-hand weapon as gloves", () => {
    assert.equal(kindFromPiece("Main Hand", "", "Coral Riptide Dagger"), "oneHand");
    assert.equal(kindFromPiece("Two Hand", "", "Deadly Strike Bow"), "twoHand");
    assert.equal(kindFromPiece("Off Hand", "", "Coral Riptide Shield"), "shield");
    assert.equal(kindFromPiece("Hands", "Medium Hands", "Coral Riptide Bracers"), "hands");
  });

  it("treats perfected as its own set and ignores the word the", () => {
    assert.equal(gearSetKey("Slivers of the Null Arca"), gearSetKey("Slivers of Null Arca"));
    assert.notEqual(gearSetKey("Perfected Slivers of the Null Arca"), gearSetKey("Slivers of the Null Arca"));
  });
});

describe("arrange", () => {
  it("puts body on the body slots and weapons plus jewelry on the front when nothing is owned", () => {
    const result = arrange(
      [set({ role: "body", name: "Null Arca" }), set({ role: "front", name: "Corpseburster" })],
      [],
      [],
    );
    for (const id of ["chest", "hands", "waist", "legs", "feet"]) {
      const piece = slot(result.placed, id);
      assert.equal(piece.setName, "Null Arca");
      assert.equal(piece.source.kind, "farm");
    }
    for (const id of ["neck", "ring1", "ring2", "frontBar"]) {
      const piece = slot(result.placed, id);
      assert.equal(piece.setName, "Corpseburster");
      assert.equal(piece.source.kind, "farm");
    }
    assert.equal(result.frontStyle, "twohand");
    assert.equal(slot(result.placed, "frontBar").pieces, 2);
    assert.equal(result.placed.some((piece) => piece.slot === "head"), false);
  });

  it("wears owned body pieces and owned jewelry on their own slots", () => {
    const body = set({
      role: "body",
      name: "Slivers of the Null Arca",
      collected: 22,
      total: 22,
      collectedKinds: ALL,
    });
    const front = set({
      role: "front",
      name: "Corpseburster",
      collected: 22,
      total: 22,
      collectedKinds: ALL,
    });
    const owned = [
      own("Slivers of Null Arca", "chest", "Divines"),
      own("Slivers of Null Arca", "hands", "Divines"),
      own("Slivers of Null Arca", "waist", "Divines"),
      own("Slivers of Null Arca", "legs", "Divines"),
      own("Corpseburster", "neck", "Divines", "backpack", "Rosaria"),
      own("Corpseburster", "ring", "Divines", "bank", "Rosaria"),
      own("Corpseburster", "ring", "Bloodthirsty", "worn", "Rosaria"),
    ];
    const result = arrange([body, front], owned, divines);
    for (const id of ["chest", "hands", "waist", "legs"]) {
      const piece = slot(result.placed, id);
      assert.equal(piece.setName, body.name);
      assert.equal(piece.source.kind, "owned");
      assert.equal(piece.source.kind === "owned" && piece.source.divines, true);
    }
    const feet = slot(result.placed, "feet");
    assert.equal(feet.setName, body.name);
    assert.equal(feet.source.kind, "transmute");
    assert.equal(feet.source.kind === "transmute" && feet.source.crystals, 25);

    assert.equal(slot(result.placed, "neck").source.kind, "owned");
    const rings = [slot(result.placed, "ring1"), slot(result.placed, "ring2")];
    assert.equal(rings.filter((piece) => piece.source.kind === "owned").length, 1);
    assert.equal(rings.filter((piece) => piece.source.kind === "transmute").length, 1);
    const reconstructed = rings.find((piece) => piece.source.kind === "transmute");
    assert.match(reconstructed?.aside ?? "", /Bloodthirsty/);
    assert.match(reconstructed?.aside ?? "", /50/);
    assert.equal(slot(result.placed, "frontBar").setName, "Corpseburster");
    assert.equal(slot(result.placed, "frontBar").source.kind, "transmute");
  });

  it("moves a necklace of the body set and a ring of the front set onto the slots that are already made", () => {
    const result = arrange(
      [set({ role: "body", name: "Null Arca" }), set({ role: "front", name: "Corpseburster" })],
      [own("Null Arca", "neck", "Divines", "bank", "Faris"), own("Corpseburster", "ring", "Divines", "backpack", "Rosaria")],
      divines,
    );
    const neck = slot(result.placed, "neck");
    assert.equal(neck.setName, "Null Arca");
    assert.equal(neck.source.kind, "owned");
    assert.equal(neck.preferred, false);
    const rings = [slot(result.placed, "ring1"), slot(result.placed, "ring2")];
    assert.equal(rings.filter((piece) => piece.setName === "Corpseburster" && piece.source.kind === "owned").length, 1);
    assert.equal(slot(result.placed, "chest").setName, "Null Arca");
  });

  it("gives the one free ring to the mythic and keeps the owned second ring", () => {
    const result = arrange(
      [
        set({ role: "body", name: "Null Arca", collected: 22, total: 22, collectedKinds: ALL }),
        set({ role: "front", name: "Corpseburster", collected: 1, total: 22, collectedKinds: ["ring", "neck", "twoHand"] }),
        set({ role: "mythic", name: "Ring of the Pale Order", kinds: ["ring"], collected: 1, total: 1, collectedKinds: ["ring"] }),
      ],
      [
        own("Null Arca", "ring", "Divines"),
        own("Corpseburster", "ring", "Bloodthirsty"),
        own("Pale Order", "ring", "Bloodthirsty", "subscriberBank", "Rosaria"),
      ],
      divines,
    );
    const mythic = result.placed.find((piece) => piece.role === "mythic");
    assert.ok(mythic);
    assert.equal(mythic?.slot, "ring1");
    // The owned mythic is not Divines, and a one-piece set reconstructs for 25,
    // which is cheaper than changing the trait for 50.
    assert.equal(mythic?.source.kind, "transmute");
    assert.equal(mythic?.source.kind === "transmute" && mythic.source.crystals, 25);
    // The remaining ring goes to Corpseburster. Changing its trait is 50 crystals.
    // Giving the Divines Null Arca ring this slot would force Corpseburster to farm
    // a piece instead, which costs more than reconstructing a Null Arca armor piece.
    const other = slot(result.placed, "ring2");
    assert.equal(other.setName, "Corpseburster");
    assert.equal(other.source.kind, "owned");
    assert.equal(other.source.kind === "owned" && other.source.traitChangeCrystals, 50);
  });

  it("crafts the contested slot when reconstruction would cost more", () => {
    const result = arrange(
      [
        set({ role: "body", name: "Order's Wrath", kinds: ["chest"], pieces: 1, crafted: true, traitsNeeded: 4 }),
        set({
          role: "front",
          name: "Corpseburster",
          kinds: ["chest"],
          pieces: 1,
          collected: 1,
          total: 22,
          collectedKinds: ["chest"],
        }),
      ],
      [],
      divines,
    );
    assert.equal(result.placed.length, 1);
    assert.equal(result.placed[0]?.setName, "Order's Wrath");
    assert.equal(result.placed[0]?.source.kind, "craft");
    assert.equal(result.short.some((row) => row.setName === "Corpseburster"), true);
  });

  it("reconstructs for 25 instead of spending 50 to change an owned trait", () => {
    const result = arrange(
      [set({ role: "body", name: "Null Arca", kinds: ["chest"], pieces: 1, collected: 22, total: 22, collectedKinds: ["chest"] })],
      [own("Null Arca", "chest", "Infused", "worn", "Faris")],
      divines,
    );
    const chest = slot(result.placed, "chest");
    assert.equal(chest.source.kind, "transmute");
    assert.equal(chest.source.kind === "transmute" && chest.source.crystals, 25);
    assert.match(chest.aside ?? "", /Infused/);
    assert.match(chest.aside ?? "", /Faris/);
    assert.match(chest.aside ?? "", /Worn/);
  });

  it("lets a shoulder mythic take the shoulder and leaves the monster one piece short", () => {
    const result = arrange(
      [
        set({ role: "monster", name: "Slimecraw", kinds: ["head", "shoulders"], pieces: 2 }),
        set({ role: "mythic", name: "Spaulder of Ruin", kinds: ["shoulders"], collected: 1, total: 1, collectedKinds: ["shoulders"] }),
      ],
      [own("Slimecraw", "head", "Divines", "worn", "Faris")],
      divines,
    );
    assert.equal(slot(result.placed, "shoulders").role, "mythic");
    assert.equal(slot(result.placed, "head").setName, "Slimecraw");
    assert.equal(slot(result.placed, "head").source.kind, "owned");
    assert.deepEqual(
      result.short.find((row) => row.role === "monster"),
      { role: "monster", setName: "Slimecraw", have: 1, want: 2 },
    );
  });

  it("uses two owned daggers on the front bar when no two-hander exists", () => {
    const result = arrange(
      [set({ role: "front", name: "Corpseburster", kinds: ["oneHand", "twoHand", "neck", "ring"], pieces: 5 })],
      [own("Corpseburster", "oneHand", "Nirnhoned", "worn", "Rosaria"), own("Corpseburster", "oneHand", "Precise", "backpack", "Rosaria")],
      [],
    );
    assert.equal(result.frontStyle, "dual");
    assert.equal(slot(result.placed, "frontMain").source.kind, "owned");
    assert.equal(slot(result.placed, "frontOff").source.kind, "owned");
  });

  it("does not wear one ring on both ring slots", () => {
    const result = arrange(
      [set({ role: "front", name: "Corpseburster", collected: 22, total: 22, collectedKinds: ALL })],
      [own("Corpseburster", "ring", "Divines")],
      divines,
    );
    const rings = [slot(result.placed, "ring1"), slot(result.placed, "ring2")];
    assert.equal(rings.filter((piece) => piece.source.kind === "owned").length, 1);
    assert.equal(rings.filter((piece) => piece.source.kind === "transmute").length, 1);
  });
});
