import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { effectText, effectsText, findStat, formatPercent, labelFromKey, readStats } from "./stats";
import { readBuffs } from "./buffs";

describe("stats, worded as the game's window", () => {
  const stats = {
    main: [
      { key: "magicka_max", stat: 1, label: "Maximum Magicka", value: 38215 },
      { key: "spell_power", stat: 7, label: null, value: 4102 },
    ],
    advanced: [
      { category: "Combat", key: "critical_chance", stat: 102, label: "Critical Chance", format: "flatOrPercent", flat: 21918, percent: 55.24 },
      { category: "Combat", key: "critical_damage", stat: 101, label: "Critical Damage", format: "percent", flat: null, percent: 71 },
      { category: "Combat", key: "physical_penetration", stat: 103, label: "Physical Penetration", format: "flatAndPercent", flat: 7000, percent: 21.2 },
      { category: "Rewards", key: "all_xp", stat: 104, label: "Experience Gain", format: "flat", flat: null, percent: null },
    ],
  };

  it("keeps the game's rows and order, and names an unnamed row from its key", () => {
    const r = readStats(stats)!;
    assert.deepEqual(r.main.map((s) => [s.label, s.text]), [["Maximum Magicka", "38,215"], ["Spell Power", "4,102"]]);
  });

  it("shows an Advanced Stat by its format, and drops one with no value", () => {
    const r = readStats(stats)!;
    assert.deepEqual(r.advanced.map((g) => g.category), ["Combat"]);
    assert.deepEqual(
      r.advanced[0].stats.map((s) => s.text),
      ["55.2%", "71%", "7,000 (21.2%)"],
    );
    assert.equal(findStat(r, "critical_damage")?.percent, 71);
    assert.equal(findStat(r, "magicka_max")?.value, 38215);
    assert.equal(findStat(r, "missing"), null);
  });

  it("is null before the addon saved stats", () => {
    assert.equal(readStats(null), null);
    assert.equal(readStats({ main: [], advanced: [] }), null);
  });

  it("words what an ability adds", () => {
    assert.equal(effectText({ key: "critical_damage", stat: 1, label: "Critical Damage", value: 11, format: "percent" }), "+11% Critical Damage");
    assert.equal(effectText({ key: "weapon_and_spell_damage", stat: 2, label: null, value: 238 }), "+238 Weapon And Spell Damage");
    assert.equal(effectsText([]), null);
    assert.equal(formatPercent(9.149), "9.1%");
    assert.equal(labelFromKey("health_regen_combat"), "Health Regen Combat");
  });

  it("gives every lasting effect its text and amount", () => {
    const [b] = readBuffs(
      [{ name: "Boon: The Lord", mundus: true, description: "Increases your Max Health by 2,231.", effects: [{ key: "health_max", stat: 3, label: "Maximum Health", value: 2231 }] }],
      0,
    );
    assert.equal(b.description, "Increases your Max Health by 2,231.");
    assert.equal(b.amount, "+2,231 Maximum Health");
  });
});
