import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Character, WardrobeSetup } from "../snapshot/schema";
import { countDown, freshness, knownAddon, parseWornSlot, readSetup, remainingNow } from "./index";

describe("addons and freshness", () => {
  it("knows Wizard's Wardrobe is a third-party addon holding plans", () => {
    const ww = knownAddon("WizardsWardrobe")!;
    assert.equal(ww.author, "third-party");
    assert.equal(ww.kind, "plans");
    assert.equal(knownAddon("NirnsideSnapshot")!.kind, "state");
  });

  it("counts saved timers down and knows when a reset has passed", () => {
    assert.equal(countDown(3600, 600), 3000);
    assert.equal(countDown(100, 600), 0);
    assert.equal(remainingNow(3600, 1000, 1600), 3000);
    assert.equal(freshness(1000, 5000, 4000).pastReset, true);
    assert.equal(freshness(null, 5000).savedAt, null);
  });

  it("reads Wizard's Wardrobe slot labels", () => {
    assert.equal(parseWornSlot("Backup Main"), "mainhand");
    assert.equal(parseWornSlot("Backup Off"), "offhand");
  });
});

describe("a Wizard's Wardrobe setup against the game model", () => {
  const setup = WardrobeSetup.parse({
    name: "Boss",
    gear: [
      { slot: "Head", name: "Slimecraw Helm" },
      { slot: "Main Hand", name: "Dagger of Lancer" },
      { slot: "Off Hand", name: "Axe of Lancer" },
      { slot: "Backup Main", name: "Lightning Staff of Torment" },
    ],
    bars: [
      { bar: "front", skills: [{ name: "Surprise Attack" }, { name: "Rapid Strikes" }] },
      { bar: "back", skills: [{ name: "Rapid Strikes" }, { name: "Elemental Blockade" }] },
    ],
  });
  const lines: Record<string, string> = {
    "rapid strikes": "Dual Wield",
    "elemental blockade": "Destruction Staff",
    "surprise attack": "Assassination",
  };
  const character = Character.parse({
    id: "c",
    name: "C",
    class: "Nightblade",
    race: "Nord",
    alliance: "Ebonheart Pact",
    equipped: [
      { slot: "Head", name: "Slimecraw Helm" },
      { slot: "Main Hand", bar: "front", name: "Dagger of Lancer" },
      { slot: "Off Hand", bar: "front", name: "Sword of Lancer" },
      { slot: "Main Hand", bar: "back", name: "Lightning Staff of Torment" },
    ],
  });

  it("knows each bar's weapon line and flags skills the bar can't use", () => {
    const r = readSetup(setup, character, (n) => lines[n.toLowerCase()] ?? null);
    assert.deepEqual(r.weaponLines, { front: "Dual Wield", back: "Destruction Staff" });
    assert.deepEqual(r.misplacedSkills, [{ bar: "back", skill: "Rapid Strikes", line: "Dual Wield" }]);
  });

  it("compares the plan with what is worn", () => {
    const r = readSetup(setup, character, () => null);
    assert.deepEqual(r.gearDiff, [{ slot: "Off Hand", planned: "Axe of Lancer", worn: "Sword of Lancer" }]);
    assert.equal(r.wornNow, false);
  });
});
