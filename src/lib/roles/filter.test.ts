import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { characterMatches, filterCharacters, rolesForCharacter } from "./filter";
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
