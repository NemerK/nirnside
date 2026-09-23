import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { loadSnapshotFromFile } from "../snapshot/load";
import { SkillMorph } from "../snapshot/schema";
import {
  abilityIsKnown,
  bestRank,
  displayAbility,
  knownAbilityNames,
  romanRank,
  slotLabel,
  xpProgress,
} from "./ability";

describe("ability display", () => {
  it("shows the base when only the base is purchased", () => {
    const ability = SkillMorph.parse({
      name: "Death Stroke",
      rank: 4,
      morph: 0,
      purchased: true,
      morphs: [
        { slot: 0, name: "Death Stroke", rank: 4, purchased: true },
        { slot: 1, name: "Incapacitating Strike", purchased: false },
        { slot: 2, name: "Soul Harvest", purchased: false },
      ],
    });
    assert.deepEqual(displayAbility(ability), {
      name: "Death Stroke",
      morphSlot: 0,
      showingMorph: false,
    });
  });

  it("shows the slotted morph when a morph is purchased", () => {
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
    assert.deepEqual(displayAbility(ability), {
      name: "Merciless Resolve",
      morphSlot: 2,
      showingMorph: true,
    });
    assert.equal(ability.morphs[0].rank, 4);
    assert.equal(ability.morphs[1].rank, 3);
    assert.equal(ability.morphs[2].rank, 4);
  });

  it("falls back to a purchased morph if the current slot is missing", () => {
    const ability = SkillMorph.parse({
      name: "Grim Focus",
      rank: 4,
      morph: null,
      purchased: true,
      morphs: [
        { slot: 0, name: "Grim Focus", rank: 4, purchased: true },
        { slot: 1, name: "Relentless Focus", rank: 3, purchased: true },
        { slot: 2, name: "Merciless Resolve", purchased: false },
      ],
    });
    assert.deepEqual(displayAbility(ability), {
      name: "Relentless Focus",
      morphSlot: 1,
      showingMorph: true,
    });
  });

  it("keeps older snapshots that only recorded the selected morph", () => {
    const ability = SkillMorph.parse({
      name: "Killer's Blade",
      rank: 4,
      morph: 1,
      purchased: true,
    });
    assert.equal(ability.morphs.length, 0);
    assert.deepEqual(displayAbility(ability), {
      name: "Killer's Blade",
      morphSlot: 1,
      showingMorph: true,
    });
  });

  it("does not treat an unpurchased ability as known", () => {
    const ability = SkillMorph.parse({
      name: "Vampiric Drain",
      rank: 0,
      morph: 0,
      purchased: false,
      morphs: [
        { slot: 0, name: "Vampiric Drain", purchased: false },
        { slot: 1, name: "Drain Vigor", purchased: false },
      ],
    });
    assert.equal(abilityIsKnown(ability), false);
    assert.deepEqual(knownAbilityNames(ability), []);
  });

  it("does not treat a rank-0 base flag as a purchased skill", () => {
    const ability = SkillMorph.parse({
      name: "Swallow Soul",
      rank: 0,
      morph: 0,
      purchased: true,
      morphs: [
        { slot: 0, name: "Swallow Soul", rank: 0, purchased: true },
        { slot: 1, name: "Funnel Health", purchased: true },
        { slot: 2, name: "Swallow Soul", rank: 0, purchased: true },
      ],
    });
    assert.equal(abilityIsKnown(ability), false);
    assert.deepEqual(displayAbility(ability), {
      name: "Swallow Soul",
      morphSlot: 0,
      showingMorph: false,
    });
    assert.deepEqual(knownAbilityNames(ability), []);
  });

  it("formats ranks without inventing numbers", () => {
    assert.equal(romanRank(1), "I");
    assert.equal(romanRank(3), "III");
    assert.equal(romanRank(4), "IV");
    assert.equal(romanRank(null), "—");
    assert.equal(romanRank(0), "—");
    assert.equal(slotLabel(0), "Base");
    assert.equal(slotLabel(2), "Morph 2");
  });

  it("prefers the real progression rank over a zeroed slot rank", () => {
    // A leveled-but-unpurchased base can read 0 while the ability's shared
    // progression rank is IV — show IV, not 0.
    assert.equal(bestRank(0, 4), 4);
    assert.equal(bestRank(4, 0), 4);
    // A known lower slot rank still wins over an unknown ability rank.
    assert.equal(bestRank(3, null), 3);
    // Nothing captured stays unknown (em dash), never a guessed number.
    assert.equal(bestRank(null, undefined), null);
    assert.equal(romanRank(bestRank(null, undefined)), "—");
    // A genuine rank 0 with no other signal stays 0 in data, shown as unranked.
    assert.equal(bestRank(0, null), 0);
    assert.equal(romanRank(bestRank(0, null)), "—");
  });

  it("only reports XP progress when the game supplied extents", () => {
    assert.equal(xpProgress({ slot: 1, name: "X", rank: 3, purchased: true }), null);
    assert.deepEqual(
      xpProgress({ slot: 1, name: "X", rank: 3, purchased: true, xp: 1200, xpMin: 800, xpMax: 2000 }),
      { value: 400, max: 1200 },
    );
  });
});

describe("sample snapshot morph ranks", () => {
  it("records independent base and morph ranks on Sings-With-Shadows", () => {
    const snap = loadSnapshotFromFile(resolve("data/sample/Nirnside.lua"));
    const sings = snap.characters.find((c) => c.name === "Sings-With-Shadows");
    assert.ok(sings);
    const grim = sings.skillLines
      .flatMap((l) => l.abilities)
      .find((a) => a.morphs.some((m) => m.name === "Merciless Resolve"));
    assert.ok(grim);
    assert.equal(displayAbility(grim).name, "Merciless Resolve");
    assert.equal(grim.morphs.find((m) => m.slot === 0)?.rank, 4);
    assert.equal(grim.morphs.find((m) => m.slot === 1)?.rank, 3);
    assert.equal(grim.morphs.find((m) => m.slot === 2)?.rank, 4);

    const deathStroke = sings.skillLines
      .flatMap((l) => l.abilities)
      .find((a) => a.name === "Death Stroke");
    assert.ok(deathStroke);
    assert.equal(displayAbility(deathStroke).showingMorph, false);
    assert.equal(deathStroke.morphs.find((m) => m.slot === 1)?.purchased, false);

    // Blur: leveled then respec'd out — nothing purchased, but each slot keeps
    // its own remembered rank (base IV, Mirage IV, Double Take II). Ranks are
    // NOT flattened to one shared value; every morph shows its real level.
    const blur = sings.skillLines
      .flatMap((l) => l.abilities)
      .find((a) => a.name === "Blur");
    assert.ok(blur);
    assert.equal(blur.purchased, false);
    for (const slot of blur.morphs) assert.equal(slot.purchased, false);
    assert.equal(blur.morphs.find((m) => m.slot === 0)?.rank, 4);
    assert.equal(blur.morphs.find((m) => m.slot === 1)?.rank, 4);
    assert.equal(blur.morphs.find((m) => m.slot === 2)?.rank, 2);

    // Shadowy Disguise: morphed — only the chosen morph is purchased; the base
    // and the other morph are greyed but keep their remembered ranks.
    const cloak = sings.skillLines
      .flatMap((l) => l.abilities)
      .find((a) => a.name === "Shadowy Disguise");
    assert.ok(cloak);
    assert.equal(cloak.morphs.find((m) => m.slot === 0)?.purchased, false);
    assert.equal(cloak.morphs.find((m) => m.slot === 1)?.purchased, true);
    assert.equal(cloak.morphs.find((m) => m.slot === 2)?.purchased, false);
    assert.equal(cloak.morphs.find((m) => m.slot === 2)?.rank, 2);
  });
});
