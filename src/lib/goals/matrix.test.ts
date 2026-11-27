import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildMatrix, cellText } from "./matrix";
import type { ReviewGroup, ReviewTarget } from "./review";
import type { Goal } from "./types";
import type { GoalMarkView } from "./views";

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

function target(g: Goal, people: [string, GoalMarkView][]): ReviewTarget {
  return {
    goal: g,
    title: g.target,
    audience: g.scope === "account" ? "Everyone" : "One",
    people: people.map(([id, mark]) => ({ id, name: id, className: "Templar", mark })),
    overridden: [],
    done: 0,
    known: 0,
    unknown: 0,
    complete: false,
  };
}

const short = (rank: number, need: number): GoalMarkView => ({ state: "short", label: "", rank, need });
const done: GoalMarkView = { state: "done", label: "", rank: 10, need: 10 };

describe("buildMatrix", () => {
  it("merges an account target and a character override into one row", () => {
    const acct = goal({ id: "acct" });
    const own = goal({ id: "own", scope: "character", characterId: "b", targetRank: 20, tier: "optional" });
    const groups: ReviewGroup[] = [
      { scope: "account", title: "", targets: [target(acct, [["a", done]])] },
      { scope: "character", title: "", targets: [target(own, [["b", short(12, 20)]])] },
    ];
    const [row] = buildMatrix(groups);
    assert.equal(row.targets.length, 2);
    assert.equal(row.cells.get("a")?.goal.id, "acct");
    assert.equal(row.cells.get("b")?.goal.id, "own");
    // Only the extra target still has work, so the row files under Extra.
    assert.equal(row.tier, "optional");
    assert.equal(row.open, 1);
    assert.equal(row.complete, false);
  });

  it("puts rows with work left before finished ones", () => {
    const groups: ReviewGroup[] = [
      {
        scope: "account",
        title: "",
        targets: [
          target(goal({ id: "x", target: "Alpha" }), [["a", done]]),
          target(goal({ id: "y", target: "Beta" }), [["a", { state: "undiscovered", label: "" }]]),
        ],
      },
    ];
    const rows = buildMatrix(groups);
    assert.deepEqual(rows.map((r) => r.name), ["Beta", "Alpha"]);
    assert.equal(rows[1].complete, true);
  });
});

describe("cellText", () => {
  it("prints ranks compactly", () => {
    const g = goal({});
    assert.equal(cellText({ mark: short(9, 10), goal: g, tier: "essential" }), "9/10");
    assert.equal(cellText({ mark: { state: "undiscovered", label: "" }, goal: g, tier: "essential" }), "—");
    assert.equal(
      cellText({ mark: short(2, 4), goal: goal({ domain: "ability" }), tier: "essential" }),
      "II/IV",
    );
  });
});
