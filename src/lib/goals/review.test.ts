import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { effectiveGoal } from "./effective";
import { reviewTargets } from "./review";
import type { Goal, GoalSubject } from "./types";
import type { GoalCardView } from "./views";

function subject(id: string, name: string, className = "Nightblade", roleIds: string[] = []): GoalSubject {
  return {
    id,
    name,
    className,
    lastSeen: 1,
    skillLines: [],
    scribingScripts: [],
    isVampire: false,
    isWerewolf: false,
    roleIds,
    full: true,
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
    targetRank: 8,
    extraRank: 0,
    note: "",
    createdAt: 1,
    ...over,
  };
}

const a = subject("a", "Sings-With-Shadows");
const b = subject("b", "Draugr-Bane", "Dragonknight", ["tank"]);
const c = { ...subject("c", "Bakes-Sweet-Rolls", "Arcanist"), lastSeen: null };

describe("effectiveGoal", () => {
  it("lets a character target win over an account target", () => {
    const goals = [goal({ id: "acct" }), goal({ id: "own", scope: "character", characterId: "b", targetRank: 4 })];
    assert.equal(effectiveGoal(goals, a, "skillline", "Assault")?.id, "acct");
    assert.equal(effectiveGoal(goals, b, "skillline", "assault")?.id, "own");
  });

  it("never crosses domains", () => {
    assert.equal(effectiveGoal([goal({ domain: "script" })], a, "skillline", "Assault"), null);
  });
});

describe("reviewTargets", () => {
  const goals = [goal({ id: "acct" }), goal({ id: "own", scope: "character", characterId: "b", targetRank: 4 })];
  const cards: GoalCardView[] = [
    {
      goal: goals[0],
      done: 0,
      total: 3,
      unknown: 1,
      notApplicable: 0,
      rows: [
        { id: "a", name: a.name, mark: { state: "short", label: "Rank 6 / 8" } },
        { id: "b", name: b.name, mark: { state: "short", label: "Rank 2 / 8" } },
        { id: "c", name: c.name, mark: { state: "unknown", label: "Not scanned yet" } },
      ],
    },
    {
      goal: goals[1],
      done: 0,
      total: 1,
      unknown: 0,
      notApplicable: 0,
      rows: [{ id: "b", name: b.name, mark: { state: "short", label: "Rank 2 / 4" } }],
    },
  ];

  const groups = reviewTargets({ goals, cards, subjects: [a, b, c], roles: [] });

  it("groups targets by who they are for, account first", () => {
    assert.deepEqual(
      groups.map((g) => g.title),
      ["For everyone", "For one character"],
    );
  });

  it("does not count an overridden character as short on the broader target", () => {
    const acct = groups[0].targets[0];
    assert.deepEqual(
      acct.people.map((p) => p.id),
      ["a", "c"],
    );
    assert.deepEqual(acct.overridden, [{ id: "b", name: "Draugr-Bane", by: "Assault 4", byGoalId: "own" }]);
  });

  it("separates characters it can't judge yet", () => {
    const acct = groups[0].targets[0];
    assert.equal(acct.known, 1);
    assert.equal(acct.unknown, 1);
    assert.equal(acct.complete, false);
  });

  it("names the audience in plain words", () => {
    assert.equal(groups[0].targets[0].audience, "Everyone");
    assert.equal(groups[1].targets[0].audience, "Draugr-Bane");
  });
});
