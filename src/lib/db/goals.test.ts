import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";

// Throwaway DB, seeded with an OLD-shape goals table before the module loads
// so the migration path is exercised for real.
process.env.NIRNSIDE_DB = join(tmpdir(), `nirnside-goals-test-${process.pid}.db`);

type Goals = typeof import("./goals");
let goals: Goals;

before(async () => {
  const seed = new Database(process.env.NIRNSIDE_DB as string);
  seed.exec(`
    CREATE TABLE goals (
      id            TEXT PRIMARY KEY,
      scope         TEXT NOT NULL,
      characterId   TEXT,
      lineName      TEXT NOT NULL,
      targetRank    INTEGER NOT NULL,
      note          TEXT NOT NULL DEFAULT '',
      createdAt     INTEGER NOT NULL
    );
  `);
  seed
    .prepare(
      `INSERT INTO goals (id, scope, characterId, lineName, targetRank, note, createdAt)
       VALUES ('old-a', 'account', NULL, 'Assault', 7, 'pvp', 1),
              ('old-c', 'character', 'char-1', 'Werewolf', 10, '', 2)`,
    )
    .run();
  seed.close();

  goals = await import("./goals");
});

describe("goal table migration", () => {
  it("upgrades old skill-line goals into the planner shape", () => {
    const list = goals.listGoals();
    assert.equal(list.length, 2);
    const account = list.find((g) => g.id === "old-a");
    assert.ok(account);
    assert.equal(account.domain, "skillline");
    assert.equal(account.tier, "essential");
    assert.equal(account.scope, "account");
    assert.equal(account.target, "Assault");
    assert.equal(account.targetRank, 7);
    assert.equal(account.note, "pvp");
    const personal = list.find((g) => g.id === "old-c");
    assert.ok(personal);
    assert.equal(personal.scope, "character");
    assert.equal(personal.characterId, "char-1");
    assert.equal(personal.target, "Werewolf");
  });
});

describe("goal CRUD", () => {
  it("creates planner goals in every scope and tier", async () => {
    const db = (await import("./index")).getDb();
    db.prepare(
      `INSERT OR IGNORE INTO roles (id, name, color, sortOrder) VALUES ('r1', 'Tank', '#3f7fd6', 0)`,
    ).run();

    const g1 = goals.createGoal({
      domain: "script",
      tier: "completionist",
      scope: "account",
      target: "Vitalizing Garland",
    });
    assert.equal(g1.domain, "script");
    assert.equal(g1.tier, "completionist");
    assert.equal(g1.targetRank, 0);

    const g2 = goals.createGoal({
      domain: "ability",
      tier: "essential",
      scope: "role",
      scopeKey: "r1",
      target: "Pierce Armor",
    });
    assert.equal(g2.scopeKey, "r1");

    const g3 = goals.createGoal({
      domain: "skillline",
      tier: "optional",
      scope: "class",
      scopeKey: "necromancer",
      target: "grave lord",
      targetRank: 50,
    });
    assert.equal(g3.scopeKey, "Necromancer", "class names are canonicalized");

    const g4 = goals.createGoal({
      scope: "character",
      characterId: "char-9",
      lineName: "Assault",
      targetRank: 10,
    });
    assert.equal(g4.domain, "skillline", "legacy lineName posts map to the new shape");
    assert.equal(g4.target, "Assault");
  });

  it("rejects invalid tiers, classes, ranks, duplicates, and unknown roles", () => {
    assert.throws(() => goals.createGoal({ scope: "account", target: "Assault", tier: "someday" }));
    assert.throws(() => goals.createGoal({ scope: "class", scopeKey: "Bard", target: "Assault" }));
    assert.throws(() =>
      goals.createGoal({ domain: "skillline", scope: "account", target: "Assault", targetRank: 99 }),
    );
    assert.throws(() => goals.createGoal({ domain: "skillline", scope: "account", target: "Assault", targetRank: 7 }), /already exists/);
    assert.throws(() => goals.createGoal({ scope: "role", scopeKey: "gone", target: "Assault" }));
  });

  it("patches rank, note, and tier", () => {
    const g = goals.createGoal({
      domain: "skillline",
      scope: "account",
      target: "Heavy Armor",
      targetRank: 50,
    });
    const updated = goals.updateGoal(g.id, { targetRank: 40, note: "weights", tier: "optional" });
    assert.equal(updated.targetRank, 40);
    assert.equal(updated.note, "weights");
    assert.equal(updated.tier, "optional");
    assert.throws(() => goals.updateGoal(g.id, { targetRank: 0 }));
    goals.deleteGoal(g.id);
    assert.equal(goals.getGoal(g.id), null);
  });
});
