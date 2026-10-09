import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SkillLine, SkillMorph } from "../snapshot/schema";
import { abilityIsKnown } from "./ability";
import { presentAbility, presentSkillBook } from "./present";
import {
  CLASS_MASTERY_LINE_NAME,
  CLASS_MASTERY_PASSIVES,
  CLASS_MASTERY_POINTS,
  isClassMasteryLineName,
  keepClassMasteryForCharacter,
} from "./class-mastery";

describe("class mastery identity", () => {
  it("recognizes the live U50 skill line name", () => {
    assert.equal(isClassMasteryLineName("Class Mastery"), true);
    assert.equal(isClassMasteryLineName("class mastery"), true);
    assert.equal(isClassMasteryLineName("Assassination"), false);
    assert.equal(CLASS_MASTERY_LINE_NAME, "Class Mastery");
    assert.equal(CLASS_MASTERY_POINTS, 2);
  });
});

describe("class mastery purchases", () => {
  it("treats a purchased rank-0 mastery passive as known", () => {
    const ability = SkillMorph.parse({
      name: "Inexorable Descent",
      rank: 0,
      purchased: true,
      passive: true,
    });
    assert.equal(abilityIsKnown(ability), true);
    assert.equal(presentAbility(ability, new Map()).purchased, true);
  });

  it("does not invent a purchase when the game said the passive is unbought", () => {
    const ability = SkillMorph.parse({
      name: "Wildfire Embers",
      rank: 0,
      purchased: false,
      passive: true,
    });
    assert.equal(abilityIsKnown(ability), false);
    assert.equal(presentAbility(ability, new Map()).purchased, false);
  });

  it("surfaces the Class Mastery line under Class with purchased passives counted", () => {
    const book = presentSkillBook(
      [
        SkillLine.parse({
          name: "Class Mastery",
          category: "Class",
          rank: 1,
          classMastery: true,
          abilities: [
            { name: "Inexorable Descent", purchased: true, passive: true, rank: 1 },
            { name: "Booming Voice", purchased: true, passive: true, rank: 1 },
            { name: "Wildfire Embers", purchased: false, passive: true, rank: 0 },
            { name: "Resolute Defense", purchased: false, passive: true, rank: 0 },
            { name: "Lead from the Front", purchased: false, passive: true, rank: 0 },
          ],
        }),
      ],
      new Map(),
      () => null,
    );
    assert.equal(book[0]?.name, "Class");
    const line = book[0]?.lines[0];
    assert.equal(line?.name, "Class Mastery");
    assert.equal(line?.classMastery, true);
    assert.equal(line?.abilities.filter((a) => a.purchased).length, 2);
    assert.equal(line?.abilities.filter((a) => !a.purchased).length, 3);
  });
});

function masteryLine(className: string, abilities: readonly string[]) {
  return SkillLine.parse({
    name: "Class Mastery",
    category: "Class",
    rank: 1,
    classMastery: true,
    className,
    abilities: abilities.map((name) => ({ name, purchased: false, passive: true, rank: 0 })),
  });
}

describe("class mastery per-character filter", () => {
  it("keeps only the selected character's Class Mastery tree", () => {
    const lines = [
      SkillLine.parse({ name: "Assassination", category: "Class", rank: 50, abilities: [] }),
      masteryLine("Dragonknight", CLASS_MASTERY_PASSIVES.Dragonknight),
      masteryLine("Nightblade", CLASS_MASTERY_PASSIVES.Nightblade),
      masteryLine("Sorcerer", CLASS_MASTERY_PASSIVES.Sorcerer),
      SkillLine.parse({ name: "Dual Wield", category: "Weapon", rank: 50, abilities: [] }),
    ];
    const book = presentSkillBook(lines, new Map(), () => null, "Nightblade");
    const classLines = book.find((c) => c.name === "Class")?.lines ?? [];
    const mastery = classLines.filter((l) => l.classMastery);
    assert.equal(mastery.length, 1);
    assert.equal(mastery[0]?.abilities[0]?.name, "Nocturnal Inspiration");
    assert.equal(classLines.some((l) => l.name === "Assassination"), true);
    assert.equal(book.find((c) => c.name === "Weapon")?.lines.length, 1);
  });

  it("does not fall back to Dragonknight when the character is another class", () => {
    const lines = [
      masteryLine("Dragonknight", CLASS_MASTERY_PASSIVES.Dragonknight),
      masteryLine("Arcanist", CLASS_MASTERY_PASSIVES.Arcanist),
    ];
    const book = presentSkillBook(lines, new Map(), () => null, "Arcanist");
    const mastery = book[0]?.lines.filter((l) => l.classMastery) ?? [];
    assert.equal(mastery.length, 1);
    assert.equal(mastery[0]?.abilities[0]?.name, "Abyssal Emergence");
    assert.equal(
      mastery[0]?.abilities.some((a) => a.name === "Inexorable Descent"),
      false,
    );
  });

  it("matches by ability names when the snapshot omitted className", () => {
    const dk = SkillLine.parse({
      name: "Class Mastery",
      category: "Class",
      rank: 1,
      classMastery: true,
      abilities: CLASS_MASTERY_PASSIVES.Dragonknight.map((name) => ({
        name,
        purchased: false,
        passive: true,
        rank: 0,
      })),
    });
    const templar = SkillLine.parse({
      name: "Class Mastery",
      category: "Class",
      rank: 1,
      classMastery: true,
      abilities: CLASS_MASTERY_PASSIVES.Templar.map((name) => ({
        name,
        purchased: false,
        passive: true,
        rank: 0,
      })),
    });
    const kept = keepClassMasteryForCharacter([dk, templar], "Templar");
    assert.equal(kept.length, 1);
    assert.equal(kept[0]?.abilities[0]?.name, "Bastion of Light");
  });

  it("gives each Class Mastery line a unique id so the skill book can select it", () => {
    const book = presentSkillBook(
      [
        masteryLine("Dragonknight", CLASS_MASTERY_PASSIVES.Dragonknight),
        masteryLine("Nightblade", CLASS_MASTERY_PASSIVES.Nightblade),
      ],
      new Map(),
      () => null,
    );
    const ids = book[0]?.lines.map((l) => l.id) ?? [];
    assert.equal(ids.length, 2);
    assert.equal(new Set(ids).size, 2);
    assert.equal(ids[0] === ids[1], false);
  });
});
