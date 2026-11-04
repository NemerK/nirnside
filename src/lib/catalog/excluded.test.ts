import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Database from "better-sqlite3";
import {
  deleteExcludedCatalogAndGoals,
  isExcludedCatalogLineId,
  isExcludedLineName,
  isExcludedSkillLine,
  stripVengeanceFromCharacter,
} from "./excluded";

describe("vengeance exclusion", () => {
  it("matches the Vengeance line and every Vengeance-prefixed line", () => {
    assert.equal(isExcludedLineName("Vengeance"), true);
    assert.equal(isExcludedLineName(" Vengeance Ardent Flame "), true);
    assert.equal(isExcludedLineName("Vengeance Bow"), true);
    assert.equal(isExcludedLineName("Assault"), false);
    assert.equal(isExcludedLineName("Support"), false);
    assert.equal(isExcludedLineName("Ardent Flame"), false);
    assert.equal(isExcludedSkillLine({ name: "Bow", category: "Vengeance" }), true);
    assert.equal(isExcludedSkillLine({ name: "Bow", category: "Weapon" }), false);
    assert.equal(isExcludedCatalogLineId("line-vengeance"), true);
    assert.equal(isExcludedCatalogLineId("line-vengeance-ardent-flame"), true);
    assert.equal(isExcludedCatalogLineId("line-ardent-flame"), false);
  });

  it("strips vengeance lines off a character and leaves the rest", () => {
    const kept = stripVengeanceFromCharacter({
      skillLines: [
        { name: "Assault", category: "Alliance War" },
        { name: "Vengeance", category: "Alliance War" },
        { name: "Vengeance Dual Wield", category: "Weapon" },
        { name: "Bow", category: "Vengeance" },
      ],
      classMasteries: ["Ardent Flame", "Vengeance Ardent Flame"],
    });
    assert.deepEqual(
      kept.skillLines.map((l) => l.name),
      ["Assault"],
    );
    assert.deepEqual(kept.classMasteries, ["Ardent Flame"]);

    const clean = { skillLines: [{ name: "Assault", category: "Alliance War" }], classMasteries: ["Ardent Flame"] };
    assert.equal(stripVengeanceFromCharacter(clean), clean);
  });

  it("deletes stored vengeance catalog rows and skill-line targets", () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE catalog (
        domain TEXT NOT NULL,
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        subcategory TEXT,
        source TEXT NOT NULL,
        patch TEXT,
        json TEXT NOT NULL,
        PRIMARY KEY (domain, id)
      );
      CREATE TABLE goals (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        tier TEXT NOT NULL,
        scope TEXT NOT NULL,
        characterId TEXT,
        scopeKey TEXT,
        target TEXT NOT NULL,
        targetRank INTEGER NOT NULL,
        extraRank INTEGER NOT NULL,
        note TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );
    `);
    const ins = db.prepare(
      `INSERT INTO catalog (domain, id, name, category, subcategory, source, patch, json)
       VALUES (?, ?, ?, ?, NULL, 'ingame', '', '{}')`,
    );
    ins.run("skillline", "line-assault", "Assault", "Alliance War");
    ins.run("skillline", "line-vengeance", "Vengeance", "Alliance War");
    ins.run("skillline", "line-vengeance-ardent-flame", "Vengeance Ardent Flame", "Class");
    ins.run("skillline", "line-bow", "Bow", "Vengeance");
    ins.run("skill", "sk-vengeance-hit", "Vengeance Hit", "line-vengeance-ardent-flame");
    ins.run("skill", "sk-assault-charge", "Charge", "line-assault");
    ins.run("skill", "sk-snipe", "Snipe", "line-bow");
    const goal = db.prepare(
      `INSERT INTO goals (id, domain, tier, scope, characterId, scopeKey, target, targetRank, extraRank, note, createdAt)
       VALUES (?, ?, 'essential', 'account', NULL, NULL, ?, 50, 0, '', 1)`,
    );
    goal.run("g1", "skillline", "Vengeance Ardent Flame");
    goal.run("g2", "skillline", "Assault");
    goal.run("g3", "ability", "Vengeance Hit");

    deleteExcludedCatalogAndGoals(db);

    const lines = db.prepare("SELECT id FROM catalog WHERE domain = 'skillline' ORDER BY id").all() as { id: string }[];
    assert.deepEqual(lines.map((r) => r.id), ["line-assault"]);
    const skills = db.prepare("SELECT id FROM catalog WHERE domain = 'skill' ORDER BY id").all() as { id: string }[];
    assert.deepEqual(
      skills.map((r) => r.id),
      ["sk-assault-charge", "sk-snipe"],
    );
    const goals = db.prepare("SELECT id FROM goals ORDER BY id").all() as { id: string }[];
    assert.deepEqual(
      goals.map((r) => r.id),
      ["g2", "g3"],
    );
    db.close();
  });
});
