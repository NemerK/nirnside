import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

process.env.NIRNSIDE_DB = join(tmpdir(), `nirnside-lines-test-${process.pid}.db`);

type Import = typeof import("./import");
type Heal = typeof import("./heal");
type Db = typeof import("../db");
let imp: Import;
let heal: Heal;
let dbm: Db;

before(async () => {
  imp = await import("./import");
  heal = await import("./heal");
  dbm = await import("../db");
});

const seed = {
  source: "reference",
  patch: "U51",
  skillLines: [
    { id: "line-dawns-wrath", name: "Dawn's Wrath", category: "Class", className: "Templar", maxRank: 50 },
    { id: "line-class-mastery-templar", name: "Class Mastery", category: "Class", className: "Templar" },
    { id: "line-two-handed", name: "Two Handed", category: "Weapon" },
  ],
  skills: [{ id: "sk-sun-fire", name: "Sun Fire", lineId: "line-dawns-wrath" }],
};

const rows = (domain: string) =>
  (dbm.getDb().prepare("SELECT id, subcategory, json FROM catalog WHERE domain = ? ORDER BY id").all(domain) as {
    id: string;
    subcategory: string | null;
    json: string;
  }[]).map((r) => ({ ...r, entry: JSON.parse(r.json) as Record<string, unknown> }));

describe("one id per skill line", () => {
  it("files a scan's line under the seed's id, keeping the class the scan didn't send", async () => {
    const { skillLineId } = await import("../game/skills");
    assert.equal(skillLineId("Dawn's Wrath"), "line-dawns-wrath");
    assert.equal(skillLineId("Winter’s Embrace"), "line-winters-embrace");
    assert.equal(skillLineId("Class Mastery", "Templar"), "line-class-mastery-templar");
    assert.equal(skillLineId("Class Mastery"), null);

    imp.importCatalogBundle(seed);
    // An older addon: apostrophe slugged into a hyphen, no class, Class Mastery without its class.
    imp.importCatalogBundle({
      source: "ingame",
      patch: "API101047",
      skillLines: [
        { id: "line-dawn-s-wrath", name: "Dawn's Wrath", category: "Class", icon: "/dawn.dds" },
        { id: "line-class-mastery", name: "Class Mastery", category: "Class" },
      ],
      skills: [
        { id: "sk-sun-fire", name: "Sun Fire", lineId: "line-dawn-s-wrath", description: "Burns." },
        { id: "sk-cm-passive", name: "Mastery Passive", lineId: "line-class-mastery" },
      ],
    });
    const lines = rows("skillline");
    assert.deepEqual(lines.map((l) => l.id), ["line-class-mastery-templar", "line-dawns-wrath", "line-two-handed"]);
    const dawn = lines.find((l) => l.id === "line-dawns-wrath")!;
    assert.equal(dawn.entry.className, "Templar");
    assert.equal(dawn.subcategory, "Templar");
    assert.equal(dawn.entry.icon, "/dawn.dds");
    const skills = rows("skill");
    assert.deepEqual(skills.map((s) => [s.id, s.entry.lineId]), [["sk-sun-fire", "line-dawns-wrath"]]);
  });

  it("heals copies already stored under another id, and stays healed", () => {
    const db = dbm.getDb();
    const put = db.prepare(
      "INSERT OR REPLACE INTO catalog (domain, id, name, category, subcategory, source, patch, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    );
    put.run("skillline", "line-dawn-s-wrath", "Dawn's Wrath", "Class", null, "ingame", "API1",
      JSON.stringify({ id: "line-dawn-s-wrath", name: "Dawn's Wrath", category: "Class", className: null, maxRank: 50 }));
    put.run("skillline", "line-class-mastery", "Class Mastery", "Class", null, "ingame", "API1",
      JSON.stringify({ id: "line-class-mastery", name: "Class Mastery", category: "Class", className: null }));
    put.run("skill", "sk-radiant", "Radiant Destruction", "line-dawn-s-wrath", "active", "ingame", "API1",
      JSON.stringify({ id: "sk-radiant", name: "Radiant Destruction", lineId: "line-dawn-s-wrath" }));
    // A scan once blanked the class column.
    db.prepare("UPDATE catalog SET subcategory = NULL WHERE domain = 'skillline' AND id = 'line-dawns-wrath'").run();

    // The stray line, and the ability stored under an id of its own making (sk-radiant).
    assert.deepEqual(heal.healCatalog(db), { folded: 2, dropped: 1, relabelled: 0 });
    assert.deepEqual(heal.healCatalog(db), { folded: 0, dropped: 0, relabelled: 0 });
    const lines = rows("skillline");
    assert.deepEqual(lines.map((l) => l.id), ["line-class-mastery-templar", "line-dawns-wrath", "line-two-handed"]);
    assert.equal(lines.find((l) => l.id === "line-dawns-wrath")!.subcategory, "Templar");
    assert.equal(rows("skill").find((s) => s.id === "sk-radiant-destruction")!.entry.lineId, "line-dawns-wrath");
  });

  it("never leaves a class line without its class", () => {
    const classless = rows("skillline").filter((l) => l.entry.category === "Class" && !l.entry.className);
    assert.deepEqual(classless.map((l) => l.id), []);
  });
});

describe("the shipped seed", () => {
  it("files every line under its one id, and every class line has its class", async () => {
    const { readFileSync } = await import("node:fs");
    const { skillLineId } = await import("../game/skills");
    const bundle = JSON.parse(readFileSync(join(process.cwd(), "data/catalog/skills.json"), "utf8")) as {
      skillLines: { id: string; name: string; category: string; className?: string | null }[];
      skills: { lineId: string }[];
    };
    for (const l of bundle.skillLines) {
      assert.equal(l.id, skillLineId(l.name, l.className), `${l.name} is filed under ${l.id}`);
      if (l.category === "Class") assert.ok(l.className, `${l.name} has no class`);
    }
    const ids = new Set(bundle.skillLines.map((l) => l.id));
    const orphans = bundle.skills.filter((s) => !ids.has(s.lineId)).map((s) => s.lineId);
    assert.deepEqual([...new Set(orphans)], []);
  });
});
