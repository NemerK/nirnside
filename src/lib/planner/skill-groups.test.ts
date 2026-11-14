import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { abilitiesOnPlannerLine, abilityRowsOnPlannerLine, activeAbilityRowsOnPlannerLine, groupPlannerLines, omitAbilitiesListedAsMorphs, plannerClassScopeAllows, plannerLineKey, type PlannerAbilityRow } from "./skill-groups";

const classes = ["Dragonknight", "Nightblade", "Templar"];

describe("groupPlannerLines", () => {
  it("nests class lines under their class, and other lines under the category", () => {
    const groups = groupPlannerLines(
      [
        { name: "Siphoning", category: "Class", className: "Nightblade" },
        { name: "Assassination", category: "Class", className: "Nightblade" },
        { name: "Ardent Flame", category: "Class", className: "Dragonknight" },
        { name: "Bow", category: "Weapon", className: null },
        { name: "One Hand and Shield", category: "Weapon", className: null },
        { name: "Assault", category: "Alliance War", className: null },
      ],
      classes,
    );
    assert.deepEqual(
      groups.map((g) => g.title),
      ["Class", "Weapon", "Alliance War"],
    );
    const classGroup = groups[0];
    assert.equal(classGroup.classes?.[0]?.name, "Dragonknight");
    assert.deepEqual(
      classGroup.classes?.[0]?.lines.map((l) => l.name),
      ["Ardent Flame"],
    );
    assert.deepEqual(
      classGroup.classes?.[1]?.lines.map((l) => l.name),
      ["Assassination", "Siphoning"],
    );
    assert.deepEqual(
      groups[1].lines.map((l) => l.name),
      ["Bow", "One Hand and Shield"],
    );
  });

  it("drops a class line that has no class when that line already belongs to one", () => {
    const groups = groupPlannerLines(
      [
        { name: "Dawn's Wrath", category: "Class", className: "Templar" },
        { name: "Dawn's Wrath", category: "Class", className: null },
        { name: "Winter's Embrace", category: "Class", className: null },
        { name: "Winter's Embrace", category: "Class", className: "Warden" },
        { name: "Aedric Spear", category: "Class", className: "Templar" },
        { name: "Unfiled", category: "Class", className: null },
      ],
      ["Templar", "Warden"],
    );
    const classGroup = groups[0];
    assert.deepEqual(
      classGroup.classes?.map((group) => group.name),
      ["Templar", "Warden", "Class"],
    );
    assert.deepEqual(
      classGroup.classes?.find((group) => group.name === "Templar")?.lines.map((line) => line.name),
      ["Aedric Spear", "Dawn's Wrath"],
    );
    assert.deepEqual(
      classGroup.classes?.find((group) => group.name === "Warden")?.lines.map((line) => line.name),
      ["Winter's Embrace"],
    );
    assert.deepEqual(
      classGroup.classes?.find((group) => group.name === "Class")?.lines.map((line) => line.name),
      ["Unfiled"],
    );
  });
});

describe("class mastery stays with its class", () => {
  const abilities = [
    { name: "Inexorable Descent", lineName: "Class Mastery", className: "Dragonknight" },
    { name: "Booming Voice", lineName: "Class Mastery", className: "Dragonknight" },
    { name: "Nocturnal Inspiration", lineName: "Class Mastery", className: "Nightblade" },
    { name: "Font of Power", lineName: "Class Mastery", className: null },
    { name: "Lava Whip", lineName: "Ardent Flame", className: "Dragonknight" },
  ];

  it("lists only that class's passives on its Class Mastery line", () => {
    assert.deepEqual(
      abilitiesOnPlannerLine(abilities, { name: "Class Mastery", className: "Dragonknight" }).map((a) => a.name),
      ["Inexorable Descent", "Booming Voice"],
    );
    assert.deepEqual(
      abilitiesOnPlannerLine(abilities, { name: "Class Mastery", className: "Nightblade" }).map((a) => a.name),
      ["Nocturnal Inspiration"],
    );
    assert.deepEqual(
      abilitiesOnPlannerLine(abilities, { name: "Ardent Flame", className: "Dragonknight" }).map((a) => a.name),
      ["Lava Whip"],
    );
  });

  it("recognizes a mastery passive by its live name when the snapshot omitted the class", () => {
    const unnamed = [{ name: "Font of Power", lineName: "Class Mastery", className: null }];
    assert.deepEqual(
      abilitiesOnPlannerLine(unnamed, { name: "Class Mastery", className: "Sorcerer" }).map((a) => a.name),
      ["Font of Power"],
    );
    assert.deepEqual(
      abilitiesOnPlannerLine(unnamed, { name: "Class Mastery", className: "Dragonknight" }),
      [],
    );
  });

  it("keeps a skill with its two morphs, and leaves passives in the ability column", () => {
    const rows: PlannerAbilityRow[] = [
      {
        lineName: "Ardent Flame",
        className: "Dragonknight",
        passive: false,
        base: { name: "Lava Whip", icon: null },
        morphs: [
          { name: "Molten Whip", icon: null },
          { name: "Flame Lash", icon: null },
        ],
      },
      {
        lineName: "Ardent Flame",
        className: "Dragonknight",
        passive: true,
        base: { name: "Combustion", icon: null },
        morphs: [],
      },
      {
        lineName: "Assassination",
        className: "Nightblade",
        passive: false,
        base: { name: "Death Stroke", icon: null },
        morphs: [
          { name: "Incapacitating Strike", icon: null },
          { name: "Soul Harvest", icon: null },
        ],
      },
    ];
    const flame = abilityRowsOnPlannerLine(rows, { name: "Ardent Flame", className: "Dragonknight" });
    assert.deepEqual(
      flame.map((row) => [row.base.name, ...row.morphs.map((morph) => morph.name)]),
      [
        ["Lava Whip", "Molten Whip", "Flame Lash"],
        ["Combustion"],
      ],
    );
    assert.deepEqual(
      activeAbilityRowsOnPlannerLine(rows, { name: "Ardent Flame", className: "Dragonknight" }).map((row) => row.base.name),
      ["Lava Whip"],
    );
  });

  it("drops a morph that was also stored as its own ability", () => {
    const row = (
      base: string,
      morphs: string[],
    ): PlannerAbilityRow => ({
      lineName: "Destruction Staff",
      className: null,
      passive: false,
      base: { name: base, icon: null },
      morphs: morphs.map((name) => ({ name, icon: null })),
    });
    const rows = [
      row("Elemental Blockade", []),
      row("Wall of Elements", ["Unstable Wall of Elements", "Elemental Blockade"]),
      row("Elemental Susceptibility", []),
      row("Weakness to Elements", ["Elemental Susceptibility", "Elemental Drain"]),
      row("Force Shock", ["Crushing Shock", "Force Pulse"]),
    ];
    assert.deepEqual(
      omitAbilitiesListedAsMorphs(rows).map((entry) => entry.base.name),
      ["Wall of Elements", "Weakness to Elements", "Force Shock"],
    );
    assert.deepEqual(
      abilityRowsOnPlannerLine(rows, { name: "Destruction Staff", className: null }).map((entry) => [
        entry.base.name,
        ...entry.morphs.map((morph) => morph.name),
      ]),
      [
        ["Wall of Elements", "Unstable Wall of Elements", "Elemental Blockade"],
        ["Weakness to Elements", "Elemental Susceptibility", "Elemental Drain"],
        ["Force Shock", "Crushing Shock", "Force Pulse"],
      ],
    );
  });

  it("keeps a selected class's lines and every non-class line", () => {
    assert.equal(plannerClassScopeAllows({ category: "Class", className: "Dragonknight" }, "Dragonknight"), true);
    assert.equal(plannerClassScopeAllows({ category: "Class", className: "Nightblade" }, "dragonknight"), false);
    assert.equal(plannerClassScopeAllows({ category: "Weapon", className: null }, "Dragonknight"), true);
    assert.equal(plannerClassScopeAllows({ category: "Class", className: "Nightblade" }, null), true);
  });

  it("gives each class's Class Mastery its own key", () => {
    assert.equal(plannerLineKey({ name: "Class Mastery", className: "Dragonknight" }) === plannerLineKey({ name: "Class Mastery", className: "Nightblade" }), false);
    assert.equal(plannerLineKey({ name: "Ardent Flame", className: "Dragonknight" }), "ardent flame");
  });
});
