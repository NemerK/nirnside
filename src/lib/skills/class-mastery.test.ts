import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SkillLine, SkillMorph } from "../snapshot/schema";
import { abilityIsKnown } from "./ability";
import { presentAbility, presentSkillBook } from "./present";
import { CLASS_MASTERY_LINE_NAME, CLASS_MASTERY_POINTS, isClassMasteryLineName } from "./class-mastery";

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
