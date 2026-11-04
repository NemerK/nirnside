import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { plannerAbilityIcon, plannerLineIcon, plannerScriptIcon } from "./planner-icons";

describe("planner icons", () => {
  it("uses the sword-and-board, greatsword, bow, and dual-wield line art", () => {
    assert.equal(
      plannerLineIcon({ name: "One Hand and Shield" }),
      "esoui/art/progression/icon_1handed.dds",
    );
    assert.equal(plannerLineIcon({ name: "Two Handed" }), "esoui/art/progression/icon_2handed.dds");
    assert.equal(plannerLineIcon({ name: "Bow" }), "esoui/art/progression/icon_bows.dds");
    assert.equal(plannerLineIcon({ name: "Dual Wield" }), "esoui/art/progression/icon_dualwield.dds");
  });

  it("keeps a scanned line icon ahead of the weapon art", () => {
    assert.equal(
      plannerLineIcon({ name: "Bow", catalogIcon: "esoui/art/icons/ability_bow_001.dds" }),
      "esoui/art/icons/ability_bow_001.dds",
    );
  });

  it("uses the staff ability art for the two staff lines and invents nothing for a craft", () => {
    assert.equal(
      plannerLineIcon({ name: "Destruction Staff" }),
      "esoui/art/icons/ability_destructionstaff_001.dds",
    );
    assert.equal(
      plannerLineIcon({ name: "Restoration Staff" }),
      "esoui/art/icons/ability_restorationstaff_001.dds",
    );
    assert.equal(plannerLineIcon({ name: "Woodworking" }), null);
  });

  it("gives each Class Mastery the crest of its class", () => {
    assert.equal(
      plannerLineIcon({ name: "Class Mastery", className: "Dragonknight" }),
      "/esoui/art/icons/class/class_dragonknight.dds",
    );
    assert.equal(
      plannerLineIcon({ name: "Class Mastery", className: "Nightblade" }),
      "/esoui/art/icons/class/class_nightblade.dds",
    );
  });

  it("uses a morph's known art, and the class crest only for Class Mastery passives", () => {
    assert.equal(
      plannerAbilityIcon({ name: "Molten Whip" }),
      "esoui/art/icons/ability_dragonknight_001_b.dds",
    );
    assert.equal(
      plannerAbilityIcon({ name: "Lava Whip", morphNames: ["Molten Whip", "Flame Lash"] }),
      "esoui/art/icons/ability_dragonknight_001.dds",
    );
    assert.equal(
      plannerAbilityIcon({
        name: "Inexorable Descent",
        lineName: "Class Mastery",
        className: "Dragonknight",
      }),
      "/esoui/art/icons/class/class_dragonknight.dds",
    );
    assert.equal(plannerAbilityIcon({ name: "Inexorable Descent", lineName: "Ardent Flame" }), null);
  });

  it("lets a scanned ability icon replace the name map", () => {
    assert.equal(
      plannerAbilityIcon({ name: "Molten Whip", catalogIcon: "/custom/whip.dds" }),
      "/custom/whip.dds",
    );
  });

  it("maps a script only when the name is one confirmed status or element", () => {
    assert.equal(plannerScriptIcon("Berserk"), "esoui/art/icons/ability_buff_major_berserk.dds");
    assert.equal(plannerScriptIcon("Off Balance"), "esoui/art/icons/ability_debuff_offbalance.dds");
    assert.equal(plannerScriptIcon("Stun"), "esoui/art/icons/ability_debuff_stun.dds");
    assert.equal(plannerScriptIcon("Flame Damage"), "esoui/art/progression/icon_firestaff.dds");
    assert.equal(plannerScriptIcon("Brutality and Sorcery"), null);
    assert.equal(plannerScriptIcon("Intellect and Endurance"), null);
    assert.equal(plannerScriptIcon("Savagery and Prophecy"), null);
    assert.equal(plannerScriptIcon("Interrupt"), null);
    assert.equal(plannerScriptIcon("Class Flourish"), null);
  });
});
