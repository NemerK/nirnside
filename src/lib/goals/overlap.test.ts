import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Goal } from "./types";
import { overlapNotices, type OverlapPerson } from "./overlap";

function goal(partial: Partial<Goal> & Pick<Goal, "id" | "scope" | "target">): Goal {
  return {
    domain: "skillline",
    tier: "essential",
    characterId: null,
    scopeKey: null,
    targetRank: 7,
    extraRank: 0,
    note: "",
    createdAt: 1,
    ...partial,
  };
}

const people: OverlapPerson[] = [
  { id: "sings", name: "Sings-With-Shadows", className: "Nightblade", roleIds: ["tank"] },
  { id: "bane", name: "Draugr-Bane", className: "Dragonknight", roleIds: ["healer"] },
];

describe("overlapNotices", () => {
  it("says a character plan overrides the account-wide plan", () => {
    const notices = overlapNotices({
      domain: "skillline",
      target: "Assault",
      next: { scope: "character", characterId: "sings", scopeKey: null },
      goals: [goal({ id: "g1", scope: "account", target: "Assault", targetRank: 7, extraRank: 10 })],
      people,
    });
    assert.equal(notices.length, 1);
    assert.equal(notices[0]!.relation, "overrides");
    assert.equal(notices[0]!.what, "Assault 7–10");
    assert.equal(notices[0]!.reach, "account-wide");
    assert.match(notices[0]!.sentence, /Overriding Assault 7–10/);
    assert.match(notices[0]!.sentence, /account-wide/);
    assert.match(notices[0]!.sentence, /Sings-With-Shadows/);
  });

  it("says an account-wide plan does not replace a character-specific one", () => {
    const notices = overlapNotices({
      domain: "skillline",
      target: "Assault",
      next: { scope: "account", characterId: null, scopeKey: null },
      goals: [
        goal({
          id: "g1",
          scope: "character",
          characterId: "sings",
          target: "Assault",
          targetRank: 10,
        }),
      ],
      people,
    });
    assert.equal(notices[0]!.relation, "kept");
    assert.equal(notices[0]!.reach, "character-specific");
    assert.equal(notices[0]!.detail, "Sings-With-Shadows");
    assert.match(notices[0]!.sentence, /character-specific \(Sings-With-Shadows\)/);
    assert.match(notices[0]!.sentence, /still applies/);
  });

  it("ignores the plan already set for this same audience", () => {
    const notices = overlapNotices({
      domain: "skillline",
      target: "assault",
      next: { scope: "account", characterId: null, scopeKey: null },
      goals: [goal({ id: "g1", scope: "account", target: "Assault" })],
      people,
    });
    assert.deepEqual(notices, []);
  });

  it("does not treat two different characters as an overlap", () => {
    const notices = overlapNotices({
      domain: "skillline",
      target: "Assault",
      next: { scope: "character", characterId: "bane", scopeKey: null },
      goals: [goal({ id: "g1", scope: "character", characterId: "sings", target: "Assault" })],
      people,
    });
    assert.deepEqual(notices, []);
  });

  it("overrides a class plan for one character of that class and leaves other classes alone", () => {
    const notices = overlapNotices({
      domain: "ability",
      target: "Ambush",
      next: { scope: "character", characterId: "sings", scopeKey: null },
      goals: [
        goal({
          id: "g1",
          domain: "ability",
          scope: "class",
          scopeKey: "Nightblade",
          target: "Ambush",
          targetRank: 4,
        }),
      ],
      people,
    });
    assert.equal(notices[0]!.relation, "overrides");
    assert.equal(notices[0]!.reach, "class-specific");
    assert.equal(notices[0]!.detail, "Nightblade");
    assert.equal(notices[0]!.what, "Ambush IV");
  });

  it("keeps both role plans when one character wears both roles", () => {
    const both: OverlapPerson[] = [
      { id: "sings", name: "Sings-With-Shadows", className: "Nightblade", roleIds: ["tank", "healer"] },
    ];
    const notices = overlapNotices({
      domain: "script",
      target: "Flame",
      next: { scope: "role", characterId: null, scopeKey: "tank" },
      goals: [goal({ id: "g1", domain: "script", scope: "role", scopeKey: "healer", target: "Flame", targetRank: 0 })],
      people: both,
      roles: [
        { id: "tank", name: "Tank" },
        { id: "healer", name: "Healer" },
      ],
    });
    assert.equal(notices[0]!.relation, "both");
    assert.equal(notices[0]!.reach, "role-specific");
    assert.equal(notices[0]!.detail, "Healer");
    assert.match(notices[0]!.sentence, /role-specific \(Healer\)/);
  });
});
