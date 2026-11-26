import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildLineGrid, cellFill, effectiveLineTarget } from "./grid";
import type { Goal, GoalSubject, LineMeta } from "../goals/types";

function subject(over: Partial<GoalSubject>): GoalSubject {
  return {
    id: "a",
    name: "A",
    className: "Nightblade",
    lastSeen: 100,
    skillLines: [],
    scribingScripts: [],
    isVampire: false,
    isWerewolf: false,
    roleIds: [],
    full: true,
    ...over,
  };
}

function goal(over: Partial<Goal>): Goal {
  return {
    id: "g",
    domain: "skillline",
    tier: "essential",
    scope: "account",
    characterId: null,
    scopeKey: null,
    target: "Assault",
    targetRank: 10,
    extraRank: 0,
    note: "",
    createdAt: 1,
    ...over,
  };
}

const lines = [
  { name: "Assassination", category: "Class", className: "Nightblade", maxRank: 50, icon: null },
  { name: "Ardent Flame", category: "Class", className: "Dragonknight", maxRank: 50, icon: null },
  { name: "Assault", category: "Alliance War", className: null, maxRank: 10, icon: null },
  { name: "Two Handed", category: "Weapon", className: null, maxRank: 50, icon: null },
];
const lineIndex: [string, LineMeta][] = [
  ["assassination", { category: "Class", className: "Nightblade" }],
  ["ardent flame", { category: "Class", className: "Dragonknight" }],
];

describe("effectiveLineTarget", () => {
  const nb = subject({ id: "nb", roleIds: ["tank"] });

  it("prefers the most specific scope", () => {
    const goals = [
      goal({ id: "acct", targetRank: 10 }),
      goal({ id: "mine", scope: "character", characterId: "nb", targetRank: 6 }),
    ];
    assert.equal(effectiveLineTarget(goals, nb, "Assault")?.goalId, "mine");
  });

  it("takes the higher rank between equally specific targets", () => {
    const goals = [
      goal({ id: "role", scope: "role", scopeKey: "tank", targetRank: 4 }),
      goal({ id: "class", scope: "class", scopeKey: "Nightblade", targetRank: 8 }),
    ];
    assert.equal(effectiveLineTarget(goals, nb, "Assault")?.goalId, "class");
  });

  it("ignores targets for someone else", () => {
    const goals = [goal({ scope: "character", characterId: "other" })];
    assert.equal(effectiveLineTarget(goals, nb, "Assault"), null);
  });
});

describe("buildLineGrid", () => {
  const nb = subject({
    id: "nb",
    skillLines: [
      { name: "Assassination", rank: 50, abilities: [] },
      { name: "Assault", rank: 6, abilities: [] },
    ],
  });
  const fresh = subject({ id: "new", name: "New", className: "Nightblade", lastSeen: null });

  it("leaves out class lines nobody on the roster plays", () => {
    const grid = buildLineGrid({ subjects: [nb], lines, lineIndex, goals: [] });
    const names = grid.groups.flatMap((g) => g.rows.map((r) => r.name));
    assert.ok(names.includes("Assassination"));
    assert.ok(!names.includes("Ardent Flame"));
  });

  it("orders class groups before weapon and alliance war", () => {
    const grid = buildLineGrid({ subjects: [nb], lines, lineIndex, goals: [] });
    assert.deepEqual(
      grid.groups.map((g) => g.title),
      ["Nightblade", "Weapon", "Alliance War"],
    );
  });

  it("judges done against the target when one applies, the cap otherwise", () => {
    const noGoal = buildLineGrid({ subjects: [nb], lines, lineIndex, goals: [] });
    const assault = noGoal.groups.flatMap((g) => g.rows).find((r) => r.name === "Assault")!;
    assert.equal(assault.cells[0].state, "short");

    const withGoal = buildLineGrid({ subjects: [nb], lines, lineIndex, goals: [goal({ targetRank: 5 })] });
    const met = withGoal.groups.flatMap((g) => g.rows).find((r) => r.name === "Assault")!;
    assert.equal(met.cells[0].state, "done");
    assert.equal(met.targeted, true);
  });

  it("marks undiscovered, unknown and complete honestly", () => {
    const grid = buildLineGrid({ subjects: [nb, fresh], lines, lineIndex, goals: [] });
    const rows = grid.groups.flatMap((g) => g.rows);
    const twoHanded = rows.find((r) => r.name === "Two Handed")!;
    assert.equal(twoHanded.cells[0].state, "undiscovered");
    assert.equal(twoHanded.cells[1].state, "unknown");
    const assassination = rows.find((r) => r.name === "Assassination")!;
    assert.equal(assassination.complete, false, "an unscanned character keeps the row open");
  });

  it("calls a line at its cap done when no target applies", () => {
    const grid = buildLineGrid({ subjects: [nb], lines, lineIndex, goals: [] });
    const assassination = grid.groups.flatMap((g) => g.rows).find((r) => r.name === "Assassination")!;
    assert.equal(assassination.cells[0].state, "done");
    assert.equal(assassination.complete, true);
  });
});

describe("subclassed lines", () => {
  it("shows the real rank on another class's line without counting it towards targets", () => {
    const nb = subject({ id: "nb", skillLines: [{ name: "Ardent Flame", rank: 38, abilities: [] }] });
    const dk = subject({ id: "dk", className: "Dragonknight", skillLines: [{ name: "Ardent Flame", rank: 50, abilities: [] }] });
    const grid = buildLineGrid({ subjects: [nb, dk], lines, lineIndex, goals: [] });
    const row = grid.groups.flatMap((g) => g.rows).find((r) => r.name === "Ardent Flame")!;
    assert.equal(row.cells[0].state, "short");
    assert.equal(row.cells[0].rank, 38);
    assert.equal(row.cells[0].subclassed, true);
    assert.equal(row.complete, true, "the subclass cell doesn't hold the row open");
  });
});

describe("cellFill", () => {
  it("fills towards the target, else the cap", () => {
    assert.equal(cellFill({ state: "short", rank: 25, target: null }, 50), 0.5);
    assert.equal(
      cellFill({ state: "short", rank: 5, target: { goalId: "g", scope: "account", rank: 10, extra: 0 } }, 50),
      0.5,
    );
    assert.equal(cellFill({ state: "done", rank: 50, target: null }, 50), 1);
    assert.equal(cellFill({ state: "undiscovered", rank: null, target: null }, 50), 0);
  });
});
