import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkHealth, type CatalogRowInput, type HealthInput } from "./health";
import { Character } from "../snapshot/schema";

const row = (domain: CatalogRowInput["domain"], id: string, entry: Record<string, unknown>, source = "ingame"): CatalogRowInput => ({
  domain,
  id,
  source,
  entry: { name: String(entry.name), ...entry },
});

const clean: CatalogRowInput[] = [
  row("skillline", "line-dawns-wrath", { name: "Dawn's Wrath", category: "Class", className: "Templar" }),
  row("skill", "sk-sun-fire", { name: "Sun Fire", lineId: "line-dawns-wrath" }),
  row("cp", "cp-deadly-aim", { name: "Deadly Aim", category: "Warfare", type: "slottable" }),
  row("set", "set-mothers-sorrow", { name: "Mother's Sorrow" }),
];

const char = (over: Record<string, unknown> = {}) =>
  Character.parse({
    id: "c1",
    name: "Sings",
    class: "Templar",
    race: "Nord",
    alliance: "Ebonheart Pact",
    champion: [{ name: "Warfare", stars: [{ name: "Deadly Aim" }] }],
    riding: { speed: 60 },
    stats: { main: [{ key: "health_max", stat: 1, value: 20000 }], advanced: [] },
    skillLines: [{ name: "Assault", category: "Alliance War", rank: 10, maxRank: 10 }],
    ...over,
  });

const input = (over: Partial<HealthInput> = {}): HealthInput => ({
  now: 1_000_000,
  catalog: clean,
  catalogPatch: "API101051",
  characters: [char()],
  account: { apiVersion: 101051, lastSnapshot: 1_000_000 - 3600 },
  items: [{ name: "Bread", placed: true }],
  addonApiVersion: 101051,
  ...over,
});

const status = (checks: ReturnType<typeof checkHealth>) => Object.fromEntries(checks.map((c) => [c.id, c.status]));

describe("health check", () => {
  it("passes a consistent catalog and current saves", () => {
    const checks = checkHealth(input());
    assert.deepEqual(
      checks.filter((c) => c.status !== "ok").map((c) => c.id),
      [],
    );
  });

  it("names each mistake November's catalog had", () => {
    const s = status(
      checkHealth(
        input({
          catalog: [
            ...clean,
            row("skillline", "line-dawn-s-wrath", { name: "Dawn's Wrath", category: "Class", className: null }),
            row("skill", "sk-assassins-blade", { name: "Assassin's Blade", lineId: "line-assassination" }),
            row("cp", "cp-bastion", { name: "Deadly Aim", category: "Fitness", type: "passive" }),
          ],
        }),
      ),
    );
    assert.equal(s["catalog-ids"], "problem");
    assert.equal(s["catalog-duplicates"], "problem");
    assert.equal(s["class-lines"], "problem");
    assert.equal(s["ability-lines"], "problem");
    assert.equal(s["champion-stars"], "problem");
  });

  it("notes what is merely out of date", () => {
    const s = status(
      checkHealth(
        input({
          catalogPatch: "API101046",
          addonApiVersion: 101046,
          characters: [char(), char({ id: "c2", name: "Old", riding: undefined, stats: undefined })],
          items: [{ name: "Bread", placed: false }],
          account: { apiVersion: 101051, lastSnapshot: 1_000_000 - 9 * 86_400 },
        }),
      ),
    );
    assert.equal(s["catalog-patch"], "note");
    assert.equal(s["addon-api"], "note");
    assert.equal(s["character-saves"], "note");
    assert.equal(s["item-places"], "note");
    assert.equal(s["save-age"], "note");
    assert.equal(status(checkHealth(input({ catalogPatch: null })))["catalog-patch"], "note");
  });
});
