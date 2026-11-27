import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { anyFilter, characterMatches, filterCharacters, filterChoices, filtersFromParams, rolesForCharacter } from "./filter";
import type { Role } from "./types";

const tank: Role = { id: "r-tank", name: "Tank", color: "#3f7fd6", sortOrder: 0 };
const healer: Role = { id: "r-healer", name: "Healer", color: "#4ba36a", sortOrder: 1 };
const roles = [tank, healer];
const assignments = {
  a: ["r-tank"],
  b: ["r-healer"],
  d: ["r-tank", "r-healer"],
};

const chars = [
  { id: "a", name: "Sings-With-Shadows", class: "Nightblade", race: "Khajiit" },
  { id: "b", name: "Draugr-Bane", class: "Dragonknight", race: "Nord" },
  { id: "c", name: "Bakes-Sweet-Rolls", class: "Arcanist", race: "High Elf" },
  { id: "d", name: "Two-Roles", class: "Templar", race: "Breton" },
];

describe("character role filters", () => {
  it("resolves every assigned role by character id", () => {
    assert.deepEqual(
      rolesForCharacter("a", roles, assignments).map((r) => r.name),
      ["Tank"],
    );
    assert.deepEqual(rolesForCharacter("c", roles, assignments), []);
    assert.deepEqual(
      rolesForCharacter("d", roles, assignments).map((r) => r.name),
      ["Tank", "Healer"],
    );
  });

  it("searches name, class, race, and any assigned role together", () => {
    assert.equal(characterMatches(chars[0], [tank], { q: "khajiit" }), true);
    assert.equal(characterMatches(chars[0], [tank], { q: "nightblade" }), true);
    assert.equal(characterMatches(chars[0], [tank], { q: "tank" }), true);
    assert.equal(characterMatches(chars[0], [tank], { q: "healer" }), false);
    assert.equal(characterMatches(chars[2], [], { q: "bakes" }), true);
    assert.equal(characterMatches(chars[3], [tank, healer], { q: "healer" }), true);
  });

  it("filters by class, race, and role id; a toon with several roles matches each", () => {
    assert.deepEqual(
      filterCharacters(chars, roles, assignments, { className: "Nightblade" }).map((c) => c.id),
      ["a"],
    );
    assert.deepEqual(
      filterCharacters(chars, roles, assignments, { race: "Nord" }).map((c) => c.id),
      ["b"],
    );
    assert.deepEqual(
      filterCharacters(chars, roles, assignments, { role: "r-healer" }).map((c) => c.id),
      ["b", "d"],
    );
    assert.deepEqual(
      filterCharacters(chars, roles, assignments, { role: "r-tank" }).map((c) => c.id),
      ["a", "d"],
    );
    assert.deepEqual(
      filterCharacters(chars, roles, assignments, { role: "none" }).map((c) => c.id),
      ["c"],
    );
  });
});

describe("roster filters", () => {
  const people = [
    { id: "a", name: "A", class: "Templar", race: "Altmer", alliance: "Aldmeri Dominion" },
    { id: "b", name: "B", class: "Dragonknight", race: "Nord", alliance: "Ebonheart Pact" },
    { id: "c", name: "C", class: "Templar", race: "Redguard", alliance: "Aldmeri Dominion" },
  ];
  it("filters by alliance and reads races through the model", () => {
    assert.deepEqual(filterCharacters(people, [], {}, { alliance: "Dominion" }).map((c) => c.id), ["a", "c"]);
    assert.deepEqual(filterCharacters(people, [], {}, { race: "High Elf" }).map((c) => c.id), ["a"]);
  });
  it("offers only what the roster has, in the game's order", () => {
    const choices = filterChoices(people, roles, { a: ["r-tank"] });
    assert.deepEqual(choices.classes, ["Dragonknight", "Templar"]);
    assert.deepEqual(choices.races, ["High Elf", "Redguard", "Nord"]);
    assert.deepEqual(choices.alliances, ["Aldmeri Dominion", "Ebonheart Pact"]);
    assert.deepEqual(choices.roles, [{ id: "r-tank", name: "Tank" }, { id: "none", name: "No role" }]);
  });
  it("reads filters from the URL", () => {
    const f = filtersFromParams({ q: " sun ", class: "Templar", view: "table" });
    assert.deepEqual(f, { q: "sun", className: "Templar", race: undefined, alliance: undefined, role: undefined });
    assert.equal(anyFilter(f), true);
    assert.equal(anyFilter(filtersFromParams({})), false);
  });
});
