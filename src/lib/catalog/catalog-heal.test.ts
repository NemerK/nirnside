import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";

process.env.NIRNSIDE_DB = join(tmpdir(), `nirnside-heal-test-${process.pid}.db`);

let imp: typeof import("./import");
let heal: typeof import("./heal");
let dbm: typeof import("../db");
let ids: typeof import("../game/catalog-ids");

before(async () => {
  imp = await import("./import");
  heal = await import("./heal");
  dbm = await import("../db");
  ids = await import("../game/catalog-ids");
});

const entries = (domain: string) =>
  (dbm.getDb().prepare("SELECT id, source, json FROM catalog WHERE domain = ? ORDER BY id").all(domain) as {
    id: string;
    source: string;
    json: string;
  }[]).map((r) => ({ ...(JSON.parse(r.json) as Record<string, unknown>), id: r.id, source: r.source }) as Record<string, unknown>);

describe("one row per thing in the catalog", () => {
  it("builds the same id from every spelling", () => {
    assert.equal(ids.catalogId("set", { id: "x", name: "Mother's Sorrow" }), "set-mothers-sorrow");
    assert.equal(ids.catalogId("skill", { id: "x", name: "Assassin’s Blade" }), "sk-assassins-blade");
    assert.equal(ids.catalogId("cp", { id: "cp-fitness-deadly-aim", name: "Deadly Aim" }), "cp-deadly-aim");
    assert.equal(ids.catalogId("achievement", { id: "ach-1", name: "Anything" }), "ach-1");
  });

  it("files a scan's and a seed's copies of one set as one row, with the game's facts", () => {
    imp.importCatalogBundle({
      source: "reference",
      patch: "U51",
      sets: [{ id: "set-mothers-sorrow", name: "Mother's Sorrow", setId: 209, category: "Overland" }],
    });
    imp.importCatalogBundle({
      source: "ingame",
      patch: "API101051",
      sets: [{ id: "set-mother-s-sorrow", name: "Mother's Sorrow", setId: 292, category: "Deshaan", source: "ingame" }],
    });
    const sets = entries("set");
    assert.deepEqual(sets.map((s) => [s.id, s.setId, s.category, s.source]), [["set-mothers-sorrow", 292, "Deshaan", "ingame"]]);
  });

  it("puts Champion stars under the constellation and type the saves show", () => {
    const db = dbm.getDb();
    // A save, read right by the snapshot addon.
    const save = {
      champion: [
        { name: "Warfare", stars: [{ name: "Deadly Aim", kind: "slottable" }, { name: "Hardy", kind: "passive" }, { name: "Piercing", kind: "passive" }, { name: "Biting Aura", kind: "slottable" }, { name: "Thaumaturge", kind: "slottable" }] },
      ],
    };
    db.prepare(
      "INSERT OR REPLACE INTO characters (id, name, class, race, alliance, level, championPoints, json) VALUES ('c1', 'A', 'Templar', 'Nord', 'Ebonheart Pact', 50, 3600, ?)",
    ).run(JSON.stringify(save));
    // An old scan: every Warfare star filed as Fitness, all as passive, under constellation ids.
    const stars = ["Deadly Aim", "Hardy", "Piercing", "Biting Aura", "Thaumaturge", "Fighting Finesse"];
    imp.importCatalogBundle({
      source: "ingame",
      patch: "API101051",
      cp: stars.map((name) => ({ id: `cp-fitness-${ids.catalogSlug(name)}`, name, category: "Fitness", type: "passive", source: "ingame" })),
    });
    const cp = entries("cp");
    assert.equal(cp.length, stars.length);
    for (const s of cp) assert.equal(s.category, "Warfare", `${s.name} belongs to Warfare`);
    const kind = Object.fromEntries(cp.map((s) => [s.name, s.type]));
    assert.equal(kind["Deadly Aim"], "slottable");
    assert.equal(kind["Hardy"], "passive");
    // No save knows Fighting Finesse: it moves with the five that agree, and keeps its stored type.
    assert.equal(kind["Fighting Finesse"], "passive");
    assert.deepEqual(heal.healCatalog(db), { folded: 0, dropped: 0, relabelled: 0 });
  });

  it("ships seeds filed under their own ids", () => {
    for (const [file, key, domain] of [
      ["sets", "sets", "set"],
      ["champion-points", "cp", "cp"],
      ["skills", "skillLines", "skillline"],
      ["skills", "skills", "skill"],
      ["scribing", "scripts", "script"],
      ["scribing", "grimoires", "grimoire"],
    ] as const) {
      const bundle = JSON.parse(readFileSync(join(process.cwd(), `data/catalog/${file}.json`), "utf8")) as Record<
        string,
        { id: string; name: string; className?: string | null }[]
      >;
      const off = bundle[key].filter((e) => ids.catalogId(domain, e) !== e.id).map((e) => `${e.id} (${e.name})`);
      assert.deepEqual(off, [], `${file}.${key} rows off their id`);
    }
  });
});
