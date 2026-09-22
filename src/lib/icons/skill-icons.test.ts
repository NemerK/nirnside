import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { baseIconFromMorphNames, resolveSkillIcon, skillIconByName } from "./skill-icons";

describe("skill icon map", () => {
  it("resolves a known morph name directly", () => {
    assert.equal(skillIconByName("Onslaught"), "esoui/art/icons/ability_2handed_006_a.dds");
    assert.equal(skillIconByName("Merciless Resolve"), "esoui/art/icons/ability_nightblade_005_b.dds");
  });

  it("derives a base icon by stripping a morph suffix", () => {
    // Berserker Strike (base) is unknown by name, but Onslaught is _006_a.
    assert.equal(baseIconFromMorphNames(["Berserker Rage", "Onslaught"]), "esoui/art/icons/ability_2handed_006.dds");
  });

  it("falls back through the ability name and its morphs", () => {
    assert.equal(
      resolveSkillIcon("Berserker Strike", ["Berserker Rage", "Onslaught"]),
      "esoui/art/icons/ability_2handed_006.dds",
    );
    assert.equal(resolveSkillIcon("Totally Made Up Skill", []), null);
  });
});
