import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { arrange, sourceSummary, type ArrangeSet, type Crafter, type OwnedGear, type PlacedPiece } from "./arrange";
import { defaultTraitPlan, mixFor, sameTrait, traitFor, weightFromPieceName, weightsForSet, type ArmorWeight, type TraitPlan } from "./traits";
import {
  gearSetKey,
  isMonsterSet,
  kindFromPiece,
  kindsForRole,
  reconstructionCost,
  resolveOwnedPiece,
  setMatchKeys,
  weaponTypeFromPiece,
  type FrontWeapon,
  type SlotKind,
} from "./slots";

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
    icons: partial.icons,
    collectedWeapons: partial.collectedWeapons,
    weaponIcons: partial.weaponIcons,
    collected: partial.collected ?? 0,
    total: partial.total ?? 0,
    crafted: partial.crafted ?? false,
    traitsNeeded: partial.traitsNeeded ?? null,
    armorWeights: partial.armorWeights,
  };
}

function own(
  name: string,
  kind: SlotKind,
  trait: string,
  location = "bank",
  owner = "Faris",
  weapon?: FrontWeapon,
): OwnedGear {
  return { keys: setMatchKeys(name), setId: null, itemName: `${name} ${kind}`, kind, trait, location, owner, weapon };
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

  it("keeps the weapon named on the item when the equip slot only says which hand", () => {
    const dagger = resolveOwnedPiece({ name: "Coral Riptide Dagger", equipSlot: "Main Hand" }, []);
    assert.equal(dagger?.kind, "oneHand");
    assert.equal(dagger?.weapon, "dagger");
    const bow = resolveOwnedPiece({ name: "Deadly Strike Bow", equipSlot: "Two Hand" }, []);
    assert.equal(bow?.kind, "twoHand");
    assert.equal(bow?.weapon, "bow");
    const shield = resolveOwnedPiece({ name: "Coral Riptide Shield", equipSlot: "Off Hand" }, []);
    assert.equal(shield?.kind, "shield");
    assert.equal(shield?.weapon, "shield");
    const sash = resolveOwnedPiece({ name: "Coral Riptide Sash", equipSlot: "Waist" }, []);
    assert.equal(sash?.kind, "waist");
    assert.equal(sash?.weapon, null);
  });

  it("reads armor and jewelry from the item type when the slot label is only a number", () => {
    assert.equal(kindFromPiece("Slot 3", "Heavy Chest", "Perfected Slivers of the Null Arca"), "chest");
    assert.equal(kindFromPiece("Slot 1", "Medium Head", "Huntsman's Warmask"), "head");
    assert.equal(kindFromPiece("Slot 2", "Medium Shoulders", "Slimecraw"), "shoulders");
    assert.equal(kindFromPiece("Slot 4", "Medium Hands", "Corpseburster"), "hands");
    assert.equal(kindFromPiece("Slot 5", "Heavy Waist", "Corpseburster"), "waist");
    assert.equal(kindFromPiece("Slot 6", "Heavy Legs", "Corpseburster"), "legs");
    assert.equal(kindFromPiece("Slot 7", "Heavy Feet", "Corpseburster"), "feet");
    assert.equal(kindFromPiece("Slot 8", "Necklace", "Perfected Slivers of the Null Arca"), "neck");
    assert.equal(kindFromPiece("Slot 9", "Ring", "Perfected Slivers of the Null Arca"), "ring");
    assert.equal(kindFromPiece("Slot 12", "Inferno Staff", "Corpseburster"), "twoHand");
    assert.equal(kindFromPiece("Weapon", "", "Deadly Strike Bow"), "twoHand");
    assert.equal(kindFromPiece("", "", "Huntsman's Warmask"), "head");
    assert.equal(kindFromPiece("", "", "Null Arca Guards"), "legs");
    assert.equal(kindFromPiece("", "", "Slivers of the Null Arca Guards"), "legs");
    assert.equal(kindFromPiece("", "", "Slivers of the Null Arca Arm Cops"), "shoulders");
    assert.equal(kindFromPiece("Medium Legs", "", "Slivers of the Null Arca"), "legs");
    assert.equal(kindFromPiece("", "", "Slivers of the Null Arca"), null);
    assert.equal(kindFromPiece("", "", "Vestment of Olorime"), null);
  });

  it("knows every armor word the game uses for the three weights", () => {
    const lines: Array<[string, SlotKind]> = [
      ["Hat", "head"],
      ["Helmet", "head"],
      ["Helm", "head"],
      ["Epaulets", "shoulders"],
      ["Arm Cops", "shoulders"],
      ["Pauldron", "shoulders"],
      ["Robe", "chest"],
      ["Jerkin", "chest"],
      ["Jack", "chest"],
      ["Cuirass", "chest"],
      ["Gloves", "hands"],
      ["Bracers", "hands"],
      ["Gauntlets", "hands"],
      ["Sash", "waist"],
      ["Belt", "waist"],
      ["Girdle", "waist"],
      ["Breeches", "legs"],
      ["Guards", "legs"],
      ["Greaves", "legs"],
      ["Shoes", "feet"],
      ["Boots", "feet"],
      ["Sabatons", "feet"],
      ["Necklace", "neck"],
      ["Ring", "ring"],
      ["Dagger", "oneHand"],
      ["Axe", "oneHand"],
      ["Mace", "oneHand"],
      ["Sword", "oneHand"],
      ["Greatsword", "twoHand"],
      ["Battle Axe", "twoHand"],
      ["Maul", "twoHand"],
      ["Bow", "twoHand"],
      ["Inferno Staff", "twoHand"],
      ["Ice Staff", "twoHand"],
      ["Lightning Staff", "twoHand"],
      ["Restoration Staff", "twoHand"],
      ["Shield", "shield"],
    ];
    for (const [name, kind] of lines) {
      assert.equal(kindFromPiece("", "", name), kind, name);
    }
  });

  it("uses the stickerbook slot when the item name is not a piece word", () => {
    const vestment = [{ name: "Vestment of Olorime", slot: "Chest", type: "Light Chest" }];
    assert.equal(resolveOwnedPiece({ name: "Vestment of Olorime", equipSlot: null }, vestment)?.kind, "chest");
    const ambiguous = [
      { name: "Perfected Slivers of the Null Arca", slot: "Chest", type: "Medium Chest" },
      { name: "Perfected Slivers of the Null Arca", slot: "Ring", type: "Ring" },
    ];
    assert.equal(resolveOwnedPiece({ name: "Perfected Slivers of the Null Arca", equipSlot: null }, ambiguous), null);
    assert.equal(
      resolveOwnedPiece({ name: "Perfected Slivers of the Null Arca", equipSlot: "Medium Legs" }, ambiguous)?.kind,
      "legs",
    );
    assert.equal(
      resolveOwnedPiece(
        { name: "Something Else", itemId: 184201, equipSlot: null },
        [{ name: "Null Arca Guards", slot: "Legs", type: "Medium Legs", itemId: 184201 }],
      )?.kind,
      "legs",
    );
  });

  it("treats a head-and-shoulders dungeon set as a monster set", () => {
    assert.equal(
      isMonsterSet({ mythic: false, category: "Dungeons · Shipwright's Regret", kinds: ["head", "shoulders"] }),
      true,
    );
    assert.equal(isMonsterSet({ mythic: false, category: "Monster Sets", kinds: ["head"] }), true);
    assert.equal(
      isMonsterSet({ mythic: false, category: "Trials · Dreadsail Reef", kinds: ["chest", "twoHand", "neck", "ring"] }),
      false,
    );
    assert.equal(isMonsterSet({ mythic: true, category: "Mythic Items", kinds: ["head"] }), false);
  });

  it("still fills the body when the stickerbook only listed weapons", () => {
    assert.deepEqual(kindsForRole("mythic", [], "Huntsman's Warmask"), ["head"]);
    assert.deepEqual(kindsForRole("monster", ["head"]), ["head", "shoulders"]);
    const body = kindsForRole("body", ["twoHand", "neck", "ring"]);
    const front = kindsForRole("front", ["twoHand"]);
    assert.ok(body.includes("chest") && body.includes("feet"));
    assert.ok(front.includes("neck") && front.includes("ring") && front.includes("chest"));
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
    assert.equal(slot(result.placed, "hands").label, "Hands");
    assert.equal(slot(result.placed, "waist").label, "Waist");
    assert.equal(slot(result.placed, "feet").label, "Feet");
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
    assert.equal(reconstructed?.aside, null);
    assert.equal(rings.every((piece) => piece.aside == null), true);
    assert.equal(slot(result.placed, "frontBar").setName, "Corpseburster");
    assert.equal(slot(result.placed, "frontBar").source.kind, "transmute");
  });

  it("aims one piece at its own trait and leaves the others on the group trait", () => {
    const result = arrange(
      [
        set({
          role: "body",
          name: "Orders Wrath",
          pieces: 2,
          kinds: ["chest", "hands"],
          collected: 22,
          total: 22,
          collectedKinds: ["chest", "hands"],
        }),
      ],
      [
        own("Orders Wrath", "chest", "Divines", "worn", "Sings-With-Shadows"),
        own("Orders Wrath", "hands", "Divines", "worn", "Sings-With-Shadows"),
      ],
      [],
      null,
      plan({ armorTrait: "Divines", slotTraits: { chest: "Reinforced" } }),
    );
    const chest = slot(result.placed, "chest");
    const hands = slot(result.placed, "hands");
    assert.equal(chest.source.kind, "transmute");
    assert.equal(chest.source.kind === "transmute" && chest.source.trait, "Reinforced");
    assert.equal(hands.source.kind, "owned");
    assert.equal(hands.source.kind === "owned" && hands.source.trait, "Divines");
    assert.equal(traitFor(plan({ slotTraits: { ring1: "Arcane" } }), "ring1", "ring", "front"), "Arcane");
    assert.equal(traitFor(plan({ jewelryTrait: "Bloodthirsty" }), "ring2", "ring", "front"), "Bloodthirsty");
    assert.equal(traitFor(plan({ slotTraits: { neck: "Divines" } }), "neck", "neck", "front"), "Bloodthirsty");
  });

  it("does not name a character on a ring the build is reconstructing", () => {
    const result = arrange(
      [set({ role: "body", name: "Siroria", pieces: 2, kinds: ["ring"], collected: 22, total: 22, collectedKinds: ["ring"] })],
      [own("Siroria", "ring", "Arcane", "bank", "Faris Ibn-Jabber")],
      [],
      null,
      plan({ jewelryTrait: "Bloodthirsty" }),
    );
    for (const id of ["ring1", "ring2"]) {
      const piece = slot(result.placed, id);
      assert.equal(piece.aside, null);
      assert.equal(piece.source.kind, "transmute");
      assert.doesNotMatch(sourceSummary(piece.source), /Faris/);
    }
  });

  it("names the character holding a worn piece, and only the bag for a bank piece", () => {
    const worn = arrange(
      [set({ role: "body", name: "Coral Riptide", kinds: ["chest"], pieces: 1, collected: 1, total: 12, collectedKinds: ["chest"], armorWeights: ["medium"] })],
      [weighted(own("Coral Riptide", "chest", "Divines", "worn", "Sings-With-Shadows"), "medium")],
      [],
      null,
      plan(),
    );
    assert.equal(sourceSummary(slot(worn.placed, "chest").source), "Sings-With-Shadows · Worn · Divines · Medium");

    const bank = arrange(
      [set({ role: "front", name: "Coral Riptide", kinds: ["neck"], pieces: 1, collected: 1, total: 12, collectedKinds: ["neck"] })],
      [own("Coral Riptide", "neck", "Bloodthirsty", "bank", "Sings-With-Shadows")],
      [],
      null,
      plan({ jewelryTrait: "Bloodthirsty" }),
    );
    const line = sourceSummary(slot(bank.placed, "neck").source);
    assert.equal(line, "Bank · Bloodthirsty");
    assert.doesNotMatch(line, /Sings/);

    const plus = arrange(
      [set({ role: "mythic", name: "Ring of the Pale Order", kinds: ["ring"], pieces: 1, collected: 1, total: 1, collectedKinds: ["ring"] })],
      [own("Pale Order", "ring", "Bloodthirsty", "subscriberBank", "Rosaria")],
      [],
    );
    const ring = plus.placed.find((piece) => piece.role === "mythic");
    assert.equal(sourceSummary(ring!.source), "ESO+ bank · Bloodthirsty");
    assert.doesNotMatch(sourceSummary(ring!.source), /Rosaria/);
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

  it("names the character who has a backpack piece", () => {
    const result = arrange(
      [set({ role: "body", name: "Null Arca", kinds: ["legs"], pieces: 1, collected: 22, total: 22, collectedKinds: ["legs"] })],
      [own("Null Arca", "legs", "Divines", "backpack", "Faris")],
      divines,
    );
    const legs = slot(result.placed, "legs");
    assert.equal(legs.source.kind, "owned");
    assert.equal(
      sourceSummary(legs.source),
      "Faris · Backpack · Divines",
    );
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

  it("shows the owned item's icon, and the stickerbook icon when the piece is reconstructed", () => {
    const ownedIcon = "/esoui/art/icons/gear_owned_chest.dds";
    const bookIcon = "/esoui/art/icons/gear_book_chest.dds";
    const worn = arrange(
      [set({ role: "body", name: "Null Arca", kinds: ["chest"], pieces: 1, icons: { chest: bookIcon } })],
      [{ ...own("Null Arca", "chest", "Divines"), icon: ownedIcon }],
      [],
    );
    assert.equal(slot(worn.placed, "chest").icon, ownedIcon);
    const rebuilt = arrange(
      [
        set({
          role: "body",
          name: "Null Arca",
          kinds: ["chest"],
          pieces: 1,
          collected: 22,
          total: 22,
          collectedKinds: ["chest"],
          icons: { chest: bookIcon },
        }),
      ],
      [],
      [],
    );
    assert.equal(slot(rebuilt.placed, "chest").icon, bookIcon);
    assert.equal(slot(rebuilt.placed, "chest").source.kind, "transmute");
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

  it("fills the body and the mythic when the snapshot only classified weapons", () => {
    const result = arrange(
      [
        set({
          role: "body",
          name: "Perfected Slivers of the Null Arca",
          kinds: kindsForRole("body", ["twoHand", "neck", "ring"]),
          pieces: 5,
        }),
        set({
          role: "mythic",
          name: "Huntsman's Warmask",
          kinds: kindsForRole("mythic", [], "Huntsman's Warmask"),
          pieces: 1,
          collected: 1,
          total: 1,
          collectedKinds: ["head"],
        }),
        set({
          role: "front",
          name: "Corpseburster",
          kinds: kindsForRole("front", ["twoHand"]),
          pieces: 5,
        }),
        set({
          role: "back",
          name: "Merciless Charge",
          kinds: kindsForRole("back", ["twoHand"]),
          pieces: 2,
          collected: 2,
          total: 2,
          collectedKinds: ["twoHand"],
        }),
      ],
      [own("Corpseburster", "twoHand", "Precise", "backpack", "Gurslag Soul-Corruptor")],
      [],
    );
    for (const id of ["chest", "hands", "waist", "legs", "feet"]) {
      assert.equal(slot(result.placed, id).setName, "Perfected Slivers of the Null Arca");
      assert.equal(slot(result.placed, id).source.kind, "farm");
    }
    assert.equal(slot(result.placed, "head").setName, "Huntsman's Warmask");
    assert.equal(slot(result.placed, "head").source.kind, "transmute");
    assert.equal(slot(result.placed, "frontBar").setName, "Corpseburster");
    assert.equal(slot(result.placed, "frontBar").source.kind, "owned");
    for (const id of ["neck", "ring1", "ring2"]) {
      assert.equal(slot(result.placed, id).setName, "Corpseburster");
    }
    assert.equal(slot(result.placed, "backBar").setName, "Merciless Charge");
    assert.equal(slot(result.placed, "backBar").source.kind, "transmute");
    assert.equal(
      result.short.find((row) => row.role === "body" || row.role === "front" || row.role === "mythic"),
      undefined,
    );
  });
});

describe("front-bar weapons", () => {
  it("reads the weapon type from the addon type string", () => {
    assert.equal(weaponTypeFromPiece("Slot 12", "Inferno Staff", "Corpseburster"), "inferno");
    assert.equal(weaponTypeFromPiece("Two Hand", "Bow", "Deadly Strike Bow"), "bow");
    assert.equal(weaponTypeFromPiece("Two Hand", "Battle Axe", "Turning Tide"), "battleAxe");
    assert.equal(weaponTypeFromPiece("Two Hand", "Greatsword", "Turning Tide"), "greatsword");
    assert.equal(weaponTypeFromPiece("Main Hand", "Dagger", "Coral Riptide"), "dagger");
    assert.equal(weaponTypeFromPiece("Off Hand", "Axe", "Coral Riptide"), "axe");
    assert.equal(weaponTypeFromPiece("Off Hand", "Shield", "Coral Riptide"), "shield");
    assert.equal(weaponTypeFromPiece("Slot 3", "Heavy Chest", "Null Arca"), null);
  });

  it("blocks the off hand when the front bar is a staff, bow, or two-hander", () => {
    const result = arrange(
      [
        set({
          role: "front",
          name: "Corpseburster",
          kinds: ["twoHand", "neck", "ring"],
          pieces: 5,
          collected: 3,
          total: 12,
          collectedKinds: ["twoHand"],
          collectedWeapons: ["inferno"],
        }),
      ],
      [],
      [],
      { main: "inferno", off: null },
    );
    const weapons = result.placed.filter((piece) => piece.slot.startsWith("front"));
    assert.deepEqual(
      weapons.map((piece) => piece.slot),
      ["frontBar"],
    );
    assert.equal(weapons[0]?.label, "Inferno Staff");
    assert.equal(weapons[0]?.pieces, 2);
    assert.equal(weapons[0]?.source.kind, "transmute");
    assert.equal(result.frontStyle, "twohand");
  });

  it("wears a dagger and an axe as two different front-bar items", () => {
    const result = arrange(
      [
        set({
          role: "front",
          name: "Coral Riptide",
          kinds: ["oneHand", "neck", "ring"],
          pieces: 5,
          collected: 4,
          total: 12,
          collectedKinds: ["oneHand"],
          collectedWeapons: ["dagger", "axe"],
        }),
      ],
      [
        own("Coral Riptide", "oneHand", "Nirnhoned", "worn", "Faris", "dagger"),
        own("Coral Riptide", "oneHand", "Sharpened", "bank", "Faris", "axe"),
      ],
      [],
      { main: "dagger", off: "axe" },
    );
    const main = slot(result.placed, "frontMain");
    const off = slot(result.placed, "frontOff");
    assert.equal(main.label, "Dagger");
    assert.equal(off.label, "Axe");
    assert.equal(main.source.kind, "owned");
    assert.equal(off.source.kind, "owned");
    assert.equal(main.source.kind === "owned" && main.source.trait, "Nirnhoned");
    assert.equal(off.source.kind === "owned" && off.source.trait, "Sharpened");
    assert.equal(sourceSummary(main.source), "Faris · Worn · Nirnhoned");
    assert.equal(sourceSummary(off.source), "Bank · Sharpened");
    assert.doesNotMatch(sourceSummary(off.source), /Faris/);
    assert.equal(result.placed.some((piece) => piece.slot === "frontBar"), false);
  });

  it("does not fill an axe slot with the only owned dagger", () => {
    const result = arrange(
      [
        set({
          role: "front",
          name: "Coral Riptide",
          kinds: ["oneHand"],
          pieces: 2,
          collected: 1,
          total: 12,
          collectedKinds: ["oneHand"],
          collectedWeapons: ["dagger"],
        }),
      ],
      [own("Coral Riptide", "oneHand", "Nirnhoned", "worn", "Faris", "dagger")],
      [],
      { main: "dagger", off: "axe" },
    );
    assert.equal(slot(result.placed, "frontMain").source.kind, "owned");
    assert.equal(slot(result.placed, "frontOff").source.kind, "farm");
  });

  it("reconstructs a second dagger when that piece is in the stickerbook", () => {
    const result = arrange(
      [
        set({
          role: "front",
          name: "Coral Riptide",
          kinds: ["oneHand"],
          pieces: 2,
          collected: 1,
          total: 12,
          collectedKinds: ["oneHand"],
          collectedWeapons: ["dagger"],
        }),
      ],
      [own("Coral Riptide", "oneHand", "Nirnhoned", "worn", "Faris", "dagger")],
      [],
      { main: "dagger", off: "dagger" },
    );
    assert.equal(slot(result.placed, "frontMain").source.kind, "owned");
    assert.equal(slot(result.placed, "frontOff").source.kind, "transmute");
  });
});

function plan(partial: Partial<TraitPlan> & { weight?: ArmorWeight } = {}): TraitPlan {
  const base = defaultTraitPlan();
  const mix = partial.weight ? mixFor(partial.weight) : null;
  return {
    ...base,
    ...partial,
    heavy: mix?.heavy ?? partial.heavy ?? base.heavy,
    medium: mix?.medium ?? partial.medium ?? base.medium,
    light: mix?.light ?? partial.light ?? base.light,
  };
}

function weighted(gear: OwnedGear, weight: ArmorWeight): OwnedGear {
  return { ...gear, weight };
}

describe("trait and armor weight", () => {
  it("reads piece words and trait spellings the way the game writes them", () => {
    assert.equal(weightFromPieceName("Null Arca Guards"), "medium");
    assert.equal(weightFromPieceName("Ancient Dragonguard Helm"), "heavy");
    assert.equal(weightFromPieceName("Ancient Dragonguard Hat"), "light");
    assert.equal(weightFromPieceName("Deadly Strike Helmet"), "medium");
    assert.equal(sameTrait("Well-fitted", "Well fitted"), true);
    assert.equal(sameTrait("Divines", "infused"), false);
    assert.deepEqual(weightsForSet({ crafted: false, mythic: false, monster: false, category: "Cyrodiil", seen: ["medium"] }), [
      "light",
      "medium",
      "heavy",
    ]);
    assert.deepEqual(weightsForSet({ crafted: false, mythic: false, monster: true, category: "Monster", seen: ["medium"] }), [
      "light",
      "medium",
      "heavy",
    ]);
    assert.deepEqual(weightsForSet({ crafted: false, mythic: false, monster: false, category: "Trials", seen: ["heavy", "light"] }), [
      "light",
      "medium",
      "heavy",
    ]);
    assert.deepEqual(weightsForSet({ crafted: false, mythic: false, monster: false, category: "Trials", seen: ["light"] }), ["light"]);
    assert.deepEqual(weightsForSet({ crafted: false, mythic: true, monster: false, category: "Mythic", seen: ["light"] }), ["light"]);
    assert.deepEqual(weightsForSet({ crafted: false, mythic: false, monster: false, category: "Trials", seen: [] }), []);
  });

  it("wears the chosen weight and leaves a different weight of the same piece", () => {
    const result = arrange(
      [
        set({
          role: "body",
          name: "Deadly Strike",
          kinds: ["chest"],
          pieces: 1,
          collected: 5,
          total: 5,
          collectedKinds: ["chest"],
          armorWeights: ["light", "medium", "heavy"],
        }),
      ],
      [weighted(own("Deadly Strike", "chest", "Divines", "worn", "Faris"), "medium"), weighted(own("Deadly Strike", "chest", "Divines", "bank", "Faris"), "light")],
      [],
      null,
      plan({ weight: "medium" }),
    );
    const chest = slot(result.placed, "chest");
    assert.equal(chest.source.kind, "owned");
    assert.equal(chest.weight, "medium");
    assert.match(sourceSummary(chest.source), /Medium/);
    assert.equal(chest.source.kind === "owned" && chest.source.itemName.endsWith("chest"), true);
  });

  it("reconstructs the chosen trait when that is cheaper than changing the owned piece", () => {
    const result = arrange(
      [
        set({
          role: "body",
          name: "Deadly Strike",
          kinds: ["chest"],
          pieces: 1,
          collected: 5,
          total: 5,
          collectedKinds: ["chest"],
          armorWeights: ["medium"],
        }),
      ],
      [weighted(own("Deadly Strike", "chest", "Infused", "worn", "Faris"), "medium")],
      [],
      null,
      plan({ weight: "medium", armorTrait: "Divines" }),
    );
    const chest = slot(result.placed, "chest");
    assert.equal(chest.source.kind, "transmute");
    assert.equal(chest.source.kind === "transmute" && chest.source.crystals, 25);
    assert.equal(chest.weight, "medium");
    assert.match(sourceSummary(chest.source), /Divines/);
    assert.match(sourceSummary(chest.source), /Medium/);
    assert.match(chest.aside ?? "", /Infused/);
    assert.match(chest.aside ?? "", /50/);
    assert.match(chest.aside ?? "", /Divines/);
  });

  it("changes an owned trait for 50 crystals without that trait being researched", () => {
    const result = arrange(
      [
        set({
          role: "body",
          name: "Deadly Strike",
          kinds: ["chest"],
          pieces: 1,
          collected: 1,
          total: 22,
          collectedKinds: ["chest"],
          armorWeights: ["medium"],
        }),
      ],
      [weighted(own("Deadly Strike", "chest", "Infused", "worn", "Faris"), "medium")],
      [],
      null,
      plan({ weight: "medium", armorTrait: "Divines" }),
    );
    const chest = slot(result.placed, "chest");
    assert.equal(chest.source.kind, "owned");
    assert.equal(chest.source.kind === "owned" && chest.source.traitChangeCrystals, 50);
    assert.match(sourceSummary(chest.source), /Infused → Divines/);
  });

  it("does not invent a weight the set cannot be", () => {
    const result = arrange(
      [
        set({
          role: "body",
          name: "Lucent Echoes",
          kinds: ["chest"],
          pieces: 1,
          collected: 1,
          total: 3,
          collectedKinds: ["chest"],
          armorWeights: ["light"],
        }),
      ],
      [weighted(own("Lucent Echoes", "chest", "Divines", "worn", "Faris"), "light")],
      [],
      null,
      plan({ weight: "heavy", armorTrait: "Divines" }),
    );
    const chest = slot(result.placed, "chest");
    assert.equal(chest.source.kind, "farm");
    assert.match(sourceSummary(chest.source), /Light armor/);
    assert.equal(chest.weight, "light");
  });

  it("reconstructs a monster piece in the chosen weight when the owned copy is another weight", () => {
    const result = arrange(
      [
        set({
          role: "monster",
          name: "Slimecraw",
          kinds: ["head"],
          pieces: 1,
          collected: 2,
          total: 2,
          collectedKinds: ["head"],
          armorWeights: ["light", "medium", "heavy"],
        }),
      ],
      [weighted(own("Slimecraw", "head", "Divines", "worn", "Faris"), "medium")],
      [],
      null,
      plan({ weight: "light", armorTrait: "Divines" }),
    );
    const head = slot(result.placed, "head");
    assert.equal(head.source.kind, "transmute");
    assert.equal(head.weight, "light");
    assert.match(head.aside ?? "", /medium/i);
    assert.match(head.aside ?? "", /light/i);
  });

  it("crafts the weight whose research line knows the trait", () => {
    const robeOnly: Crafter[] = [
      {
        name: "Faris",
        lines: [
          { name: "Robe", known: 9, divines: true, traits: ["Divines"] },
          { name: "Jack", known: 9, divines: false, traits: ["Infused"] },
        ],
      },
    ];
    const order = set({
      role: "body",
      name: "Order's Wrath",
      kinds: ["chest"],
      pieces: 1,
      crafted: true,
      traitsNeeded: 3,
      armorWeights: ["light", "medium", "heavy"],
    });
    const missed = arrange([order], [], robeOnly, null, plan({ weight: "medium", armorTrait: "Divines" }));
    assert.equal(slot(missed.placed, "chest").source.kind, "farm");

    const jack: Crafter[] = [{ name: "Faris", lines: [{ name: "Jack", known: 9, divines: true, traits: ["Divines"] }] }];
    const made = arrange([order], [], jack, null, plan({ weight: "medium", armorTrait: "Divines" }));
    const chest = slot(made.placed, "chest");
    assert.equal(chest.source.kind, "craft");
    assert.match(sourceSummary(chest.source), /Divines/);
    assert.match(sourceSummary(chest.source), /Medium/);
    assert.equal(chest.weight, "medium");
  });

  it("uses the jewelry trait, and never treats Divines as the jewelry goal", () => {
    const ready = arrange(
      [set({ role: "front", name: "Coral Riptide", kinds: ["neck"], pieces: 1, collected: 12, total: 12, collectedKinds: ["neck"] })],
      [own("Coral Riptide", "neck", "Bloodthirsty", "worn", "Faris")],
      [],
      null,
      plan({ jewelryTrait: "Bloodthirsty" }),
    );
    const neckReady = slot(ready.placed, "neck");
    assert.equal(neckReady.source.kind, "owned");
    if (neckReady.source.kind !== "owned") return;
    assert.equal(neckReady.source.traitChangeCrystals, null);

    const changed = arrange(
      [set({ role: "front", name: "Coral Riptide", kinds: ["neck"], pieces: 1, collected: 1, total: 12, collectedKinds: ["neck"] })],
      [own("Coral Riptide", "neck", "Arcane", "bank", "Faris")],
      [],
      null,
      plan({ jewelryTrait: "Bloodthirsty" }),
    );
    const neck = slot(changed.placed, "neck");
    assert.equal(neck.source.kind, "owned");
    assert.equal(neck.source.kind === "owned" && neck.source.traitChangeCrystals, 50);
    assert.match(sourceSummary(neck.source), /Arcane → Bloodthirsty/);
  });

  it("keeps front and back weapon traits separate", () => {
    const result = arrange(
      [
        set({
          role: "front",
          name: "Coral Riptide",
          kinds: ["twoHand"],
          pieces: 2,
          collected: 4,
          total: 12,
          collectedKinds: ["twoHand"],
          collectedWeapons: ["inferno"],
        }),
        set({
          role: "back",
          name: "Turning Tide",
          kinds: ["twoHand"],
          pieces: 2,
          collected: 3,
          total: 12,
          collectedKinds: ["twoHand"],
          collectedWeapons: ["bow"],
        }),
      ],
      [own("Coral Riptide", "twoHand", "Precise", "worn", "Faris", "inferno"), own("Turning Tide", "twoHand", "Precise", "worn", "Faris", "bow")],
      [],
      { main: "inferno", off: null },
      plan({ frontTrait: "Infused", backTrait: "Precise" }),
    );
    const front = slot(result.placed, "frontBar");
    const back = slot(result.placed, "backBar");
    assert.equal(front.source.kind, "owned");
    assert.equal(back.source.kind, "owned");
    if (front.source.kind !== "owned" || back.source.kind !== "owned") return;
    assert.equal(front.source.traitChangeCrystals, 50);
    assert.match(sourceSummary(front.source), /Precise → Infused/);
    assert.equal(back.source.traitChangeCrystals, null);
  });

  it("does not explain a different weapon on the slot that was asked for", () => {
    const result = arrange(
      [
        set({
          role: "front",
          name: "Coral Riptide",
          kinds: ["twoHand"],
          pieces: 2,
          collected: 1,
          total: 12,
          collectedKinds: ["twoHand"],
          collectedWeapons: ["bow"],
        }),
      ],
      [own("Coral Riptide", "twoHand", "Infused", "backpack", "Sings-With-Shadows", "bow")],
      [],
      { main: "inferno", off: null },
      plan({ frontTrait: "Precise" }),
    );
    const staff = slot(result.placed, "frontBar");
    assert.equal(staff.source.kind, "farm");
    assert.equal(staff.aside, null);
  });

  it("labels an uncollected piece with the weight the build asked for", () => {
    const result = arrange(
      [
        set({
          role: "body",
          name: "Deadly Strike",
          kinds: ["chest"],
          pieces: 1,
          armorWeights: ["light", "medium", "heavy"],
        }),
      ],
      [],
      [],
      null,
      plan({ weight: "light" }),
    );
    assert.equal(slot(result.placed, "chest").weight, "light");
  });

  it("keeps the body set on the body when both sets can be the asked weight", () => {
    const result = arrange(
      [set({ role: "body", name: "Null Arca" }), set({ role: "front", name: "Corpseburster" })],
      [],
      [],
      null,
      plan(),
    );
    assert.equal(slot(result.placed, "chest").setName, "Null Arca");
    assert.equal(slot(result.placed, "hands").setName, "Null Arca");
    assert.equal(slot(result.placed, "neck").setName, "Corpseburster");
    assert.equal(slot(result.placed, "frontBar").setName, "Corpseburster");
    assert.equal(slot(result.placed, "chest").weight, "medium");
  });

  it("puts a craftable front set on the armor when the body set cannot be that weight", () => {
    const result = arrange(
      [
        set({ role: "body", name: "Perfected Mantle of Siroria", pieces: 5, armorWeights: ["light"] }),
        set({ role: "monster", name: "Slimecraw", kinds: ["head"], pieces: 1, armorWeights: ["light", "medium", "heavy"] }),
        set({ role: "mythic", name: "Velothi Ur-Mage's Amulet", kinds: ["neck"], pieces: 1 }),
        set({
          role: "front",
          name: "Tide-Born Wildstalker",
          pieces: 5,
          crafted: true,
          traitsNeeded: 6,
          armorWeights: ["light", "medium", "heavy"],
        }),
      ],
      [],
      divines,
      null,
      plan(),
    );
    for (const id of ["shoulders", "chest", "hands", "waist", "legs", "feet"]) {
      const piece = slot(result.placed, id);
      assert.equal(piece.setName, "Tide-Born Wildstalker", id);
      assert.equal(piece.weight, "medium", id);
    }
    assert.equal(slot(result.placed, "head").setName, "Slimecraw");
    assert.equal(slot(result.placed, "head").weight, "medium");
    assert.equal(slot(result.placed, "neck").setName, "Velothi Ur-Mage's Amulet");
    assert.equal(slot(result.placed, "ring1").setName, "Perfected Mantle of Siroria");
    assert.equal(slot(result.placed, "ring2").setName, "Perfected Mantle of Siroria");
    assert.equal(slot(result.placed, "frontBar").setName, "Tide-Born Wildstalker");
    const weights = result.placed.filter((piece) => piece.weight).map((piece) => piece.weight);
    assert.equal(weights.filter((weight) => weight === "medium").length, 7);
    assert.equal(weights.filter((weight) => weight === "light").length, 0);
  });

  it("gives the one light slot to the light set in a 1/5/1 mix", () => {
    const result = arrange(
      [
        set({ role: "body", name: "Perfected Mantle of Siroria", pieces: 5, armorWeights: ["light"] }),
        set({ role: "monster", name: "Slimecraw", kinds: ["head"], pieces: 1, armorWeights: ["light", "medium", "heavy"] }),
        set({ role: "front", name: "Tide-Born Wildstalker", pieces: 5, crafted: true, traitsNeeded: 6, armorWeights: ["light", "medium", "heavy"] }),
      ],
      [],
      divines,
      null,
      plan({ heavy: 1, medium: 5, light: 1 }),
    );
    const armor = ["head", "shoulders", "chest", "hands", "waist", "legs", "feet"].map((id) => slot(result.placed, id));
    const count = (weight: string) => armor.filter((piece) => piece.weight === weight).length;
    assert.equal(count("heavy"), 1);
    assert.equal(count("medium"), 5);
    assert.equal(count("light"), 1);
    assert.equal(armor.filter((piece) => piece.weight === "light" && piece.setName === "Perfected Mantle of Siroria").length, 1);
    assert.equal(slot(result.placed, "frontBar").setName, "Tide-Born Wildstalker");
  });

  it("wears a mythic as it is, whatever trait and weight the build asked for", () => {
    const result = arrange(
      [
        set({
          role: "mythic",
          name: "Ring of the Pale Order",
          kinds: ["ring"],
          collected: 1,
          total: 1,
          collectedKinds: ["ring"],
        }),
      ],
      [own("Pale Order", "ring", "Bloodthirsty", "worn", "Rosaria")],
      [],
      null,
      plan({ jewelryTrait: "Infused", weight: "heavy" }),
    );
    const ring = result.placed.find((piece) => piece.role === "mythic");
    assert.equal(ring?.source.kind, "owned");
    assert.equal(ring?.weight, null);
  });
});
