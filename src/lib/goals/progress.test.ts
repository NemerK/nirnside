import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  mergeSkillLineChoices,
  progressLabel,
  skillLineProgress,
  summarizeAccountGoal,
} from "./progress";
import type { Goal, GoalSubject } from "./types";

function toon(
  id: string,
  name: string,
  opts: { lastSeen?: number | null; lines?: { name: string; rank: number }[] },
): GoalSubject {
  return {
    id,
    name,
    lastSeen: opts.lastSeen === undefined ? 1 : opts.lastSeen,
    skillLines: opts.lines ?? [],
  };
}

const assault: Goal = {
  id: "g1",
  scope: "account",
  characterId: null,
  lineName: "Assault",
  targetRank: 7,
  note: "",
  createdAt: 1,
};

describe("skillLineProgress", () => {
  it("is unknown until that character has a snapshot", () => {
    const c = toon("a", "Unseen", { lastSeen: null, lines: [{ name: "Assault", rank: 10 }] });
    assert.equal(skillLineProgress(c, "Assault", 7).state, "unknown");
    assert.equal(progressLabel(skillLineProgress(c, "Assault", 7), 7), "Not scanned yet");
  });

  it("is undiscovered when the snapshot has no such line", () => {
    const c = toon("a", "Sings", { lines: [{ name: "Vampire", rank: 10 }] });
    assert.equal(skillLineProgress(c, "Assault", 7).state, "undiscovered");
  });

  it("matches line names without caring about case", () => {
    const c = toon("a", "Sings", { lines: [{ name: "Assault", rank: 4 }] });
    const p = skillLineProgress(c, "assault", 7);
    assert.deepEqual(p, { state: "short", rank: 4 });
  });

  it("is done at or above the target rank, never by guessing", () => {
    const c = toon("a", "Sings", { lines: [{ name: "Werewolf", rank: 10 }] });
    assert.deepEqual(skillLineProgress(c, "Werewolf", 10), { state: "done", rank: 10 });
    assert.deepEqual(skillLineProgress(c, "Werewolf", 7), { state: "done", rank: 10 });
    assert.deepEqual(skillLineProgress(c, "Werewolf", 11), { state: "short", rank: 10 });
  });
});

describe("summarizeAccountGoal", () => {
  it("counts live toons against an account-wide Assault 7", () => {
    const live = [
      toon("a", "Sings", { lines: [{ name: "Assault", rank: 7 }] }),
      toon("b", "Draugr", { lines: [{ name: "Assault", rank: 3 }] }),
      toon("c", "Baker", { lastSeen: null }),
    ];
    const s = summarizeAccountGoal(assault, live);
    assert.equal(s.total, 3);
    assert.equal(s.done, 1);
    assert.equal(s.unknown, 1);
    assert.equal(s.rows[1].progress.state, "short");
  });
});

describe("mergeSkillLineChoices", () => {
  it("unions catalog and snapshot names without duplicates", () => {
    const merged = mergeSkillLineChoices(
      [{ name: "Assault", category: "Alliance War" }],
      [
        { name: "Assault", category: "Alliance War" },
        { name: "Werewolf", category: "World" },
      ],
    );
    assert.deepEqual(
      merged.map((c) => c.name),
      ["Assault", "Werewolf"],
    );
  });
});
