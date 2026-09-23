import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SkillLine, SkillMorph } from "../snapshot/schema";
import { mergeLore, presentAbility, presentSkillBook } from "./present";

describe("skill lore merge", () => {
  it("prefers in-game snapshot text over catalog", () => {
    const m = mergeLore(
      { icon: "/esoui/art/icons/ability_nightblade_005.dds", description: "From the game." },
      { icon: "/other.dds", description: "Catalog text", source: "reference" },
    );
    assert.equal(m.description, "From the game.");
    assert.equal(m.source, "ingame");
    assert.equal(m.icon, "/esoui/art/icons/ability_nightblade_005.dds");
  });

  it("falls back to catalog when the snapshot has no tooltip", () => {
    const m = mergeLore({ icon: null, description: "" }, {
      icon: "/esoui/art/icons/ability_nightblade_005.dds",
      description: "Build stacks with Light/Heavy attacks.",
      source: "reference",
    });
    assert.equal(m.description, "Build stacks with Light/Heavy attacks.");
    assert.equal(m.source, "reference");
    assert.equal(m.icon, "/esoui/art/icons/ability_nightblade_005.dds");
  });

  it("does not invent a description", () => {
    const m = mergeLore({}, undefined);
    assert.equal(m.description, "");
    assert.equal(m.source, "unknown");
    assert.equal(m.icon, null);
  });
});

describe("skill book presentation", () => {
  it("groups lines into game-order category tabs", () => {
    const book = presentSkillBook(
      [
        SkillLine.parse({ name: "Vampire", category: "World", rank: 10, abilities: [] }),
        SkillLine.parse({ name: "Assassination", category: "Class", rank: 50, abilities: [] }),
        SkillLine.parse({ name: "Dual Wield", category: "Weapon", rank: 50, abilities: [] }),
      ],
      new Map(),
      () => null,
    );
    assert.deepEqual(
      book.map((c) => c.name),
      ["Class", "Weapon", "World"],
    );
  });

  it("attaches catalog tooltip text to the slotted morph", () => {
    const lore = new Map([
      [
        "merciless resolve",
        {
          icon: "/esoui/art/icons/ability_nightblade_005.dds",
          description: "Magicka-based; the proc deals magic damage and heals.",
          source: "reference" as const,
        },
      ],
    ]);
    const ability = SkillMorph.parse({
      name: "Merciless Resolve",
      rank: 4,
      morph: 2,
      purchased: true,
      morphs: [
        { slot: 0, name: "Grim Focus", rank: 4, purchased: true },
        { slot: 1, name: "Relentless Focus", rank: 3, purchased: true },
        { slot: 2, name: "Merciless Resolve", rank: 4, purchased: true },
      ],
    });
    const view = presentAbility(ability, lore);
    assert.equal(view.name, "Merciless Resolve");
    assert.equal(view.description, "Magicka-based; the proc deals magic damage and heals.");
    assert.equal(view.icon, "/esoui/art/icons/ability_nightblade_005.dds");
    assert.equal(view.morphs[1].rankLabel, "III");
    assert.equal(view.morphs[2].current, true);
  });

  it("does not present a rank-0 base as purchased", () => {
    const ability = SkillMorph.parse({
      name: "Swallow Soul",
      rank: 0,
      morph: 0,
      purchased: true,
      description: "|cffffffDeals |cFFCC001500|r damage.|r",
      morphs: [
        { slot: 0, name: "Swallow Soul", rank: 0, purchased: true, description: "|cffffffDeals |cFFCC001500|r damage.|r" },
        { slot: 1, name: "Funnel Health", purchased: true },
      ],
    });
    const view = presentAbility(ability, new Map());
    assert.equal(view.purchased, false);
    assert.equal(view.morphs[0].purchased, false);
    assert.equal(view.morphs[0].rank, 0);
    assert.equal(view.morphs[0].rankLabel, "—");
    assert.equal(view.description.includes("|c"), true);
  });

  it("still surfaces progression ranks on unpurchased morph slots", () => {
    const ability = SkillMorph.parse({
      name: "Berserker Strike",
      rank: 4,
      morph: 0,
      purchased: false,
      morphs: [
        { slot: 0, name: "Berserker Strike", rank: 4, purchased: false },
        { slot: 1, name: "Berserker Rage", rank: 2, purchased: false },
        { slot: 2, name: "Onslaught", rank: 1, purchased: false },
      ],
    });
    const view = presentAbility(ability, new Map());
    assert.equal(view.purchased, false);
    assert.equal(view.morphs[0].purchased, false);
    assert.equal(view.morphs[0].rank, 4);
    assert.equal(view.morphs[0].rankLabel, "IV");
    assert.equal(view.morphs[1].rank, 2);
    assert.equal(view.morphs[1].rankLabel, "II");
    assert.equal(view.morphs[2].rank, 1);
    assert.equal(view.morphs[2].rankLabel, "I");
  });
});
