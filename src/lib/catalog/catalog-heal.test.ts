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
    assert.deepEqual(heal.healCatalog(db), { folded: 0, dropped: 0, relabelled: 0, cleaned: 0 });
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

describe("recipes in the catalog", () => {
  it("files entries under the scan's patch, fills missing ingredients from saves, and keeps them through a later scan", () => {
    imp.importCatalogBundle({
      source: "ingame",
      patch: "API101051",
      recipes: [
        { id: "recipe-118015", name: "Common Wheelbarrow, Flat", source: "ingame", kind: "furnishing", craft: "woodworking", ingredients: [{ name: "", quantity: 0 }] },
        { id: "recipe-33526", name: "Fishy Stick", source: "ingame", kind: "provisioning", ingredients: [{ itemId: 33753, name: "Fish", quantity: 1 }] },
      ],
    });
    const before = entries("recipe");
    assert.equal(before.find((e) => e.id === "recipe-118015")?.patch, "API101051");
    assert.deepEqual(before.find((e) => e.id === "recipe-118015")?.ingredients, []);

    const filled = imp.fillRecipeIngredients(
      new Map([
        [118015, [{ itemId: 114895, name: "Heartwood", quantity: 6 }]],
        [33526, [{ itemId: 1, name: "Not this", quantity: 9 }]],
      ]),
    );
    assert.equal(filled, 1, "only the recipe without ingredients");
    const after = entries("recipe");
    assert.equal((after.find((e) => e.id === "recipe-118015")?.ingredients as { name: string }[])[0].name, "Heartwood");
    assert.equal((after.find((e) => e.id === "recipe-33526")?.ingredients as { name: string }[])[0].name, "Fish");

    // A later scan by a character who doesn't know it brings no ingredients: the learned ones stay.
    imp.importCatalogBundle({
      source: "ingame",
      patch: "API101051",
      recipes: [{ id: "recipe-118015", name: "Common Wheelbarrow, Flat", source: "ingame", kind: "furnishing", craft: "woodworking", ingredients: [] }],
    });
    assert.equal((entries("recipe").find((e) => e.id === "recipe-118015")?.ingredients as { name: string }[])[0].name, "Heartwood");
  });
});

describe("a later scan merges into what's stored", () => {
  it("keeps a Mundus stone's effects when the next scan brings none", () => {
    imp.importCatalogBundle({
      source: "ingame",
      patch: "API101051",
      mundus: [{ id: "mundus-13940", name: "Boon: The Warrior", source: "ingame", abilityId: 13940, effects: [{ stat: 35, value: 238, label: "Weapon Damage" }] }],
    });
    imp.importCatalogBundle({
      source: "ingame",
      patch: "API101051",
      mundus: [{ id: "mundus-13940", name: "Boon: The Warrior", source: "ingame", abilityId: 13940, description: "Increases your Weapon Damage." }],
    });
    const stone = entries("mundus").find((e) => e.name === "Boon: The Warrior");
    assert.equal((stone?.effects as { value: number }[])[0]?.value, 238);
    assert.equal(stone?.description, "Increases your Weapon Damage.");
  });
});

describe("blank ingredients from an older scan", () => {
  it("are removed, so a save can fill the recipe", () => {
    const db = dbm.getDb();
    db.prepare("INSERT OR REPLACE INTO catalog (domain, id, name, category, subcategory, source, patch, json) VALUES ('recipe', 'recipe-118020', 'Old', 'furnishing', NULL, 'ingame', 'U50', ?)").run(
      JSON.stringify({ id: "recipe-118020", name: "Old", source: "ingame", ingredients: [{ name: "", quantity: 0 }, { name: "", quantity: 0 }] }),
    );
    assert.equal(heal.dropBlankIngredients(db), 1);
    assert.deepEqual(entries("recipe").find((e) => e.id === "recipe-118020")?.ingredients, []);
    assert.equal(imp.fillRecipeIngredients(new Map([[118020, [{ name: "Heartwood", quantity: 2 }]]])), 1);
  });
});
