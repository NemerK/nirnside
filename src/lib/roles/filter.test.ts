import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { characterMatches, filterCharacters, roleForCharacter } from "./filter";
import type { Role } from "./types";

const tank: Role = { id: "r-tank", name: "Tank", color: "#3f7fd6", sortOrder: 0 };
const healer: Role = { id: "r-healer", name: "Healer", color: "#4ba36a", sortOrder: 1 };
const roles = [tank, healer];
const assignments = { a: "r-tank", b: "r-healer" };

const chars = [
  { id: "a", name: "Sings-With-Shadows", class: "Nightblade", race: "Khajiit" },
  { id: "b", name: "Draugr-Bane", class: "Dragonknight", race: "Nord" },
  { id: "c", name: "Bakes-Sweet-Rolls", class: "Arcanist", race: "High Elf" },
];

describe("character role filters", () => {
  it("resolves the assigned role by character id", () => {
    assert.equal(roleForCharacter("a", roles, assignments)?.name, "Tank");
    assert.equal(roleForCharacter("c", roles, assignments), null);
  });

  it("searches name, class, race, and role together", () => {
    assert.equal(characterMatches(chars[0], tank, { q: "khajiit" }), true);
    assert.equal(characterMatches(chars[0], tank, { q: "nightblade" }), true);
    assert.equal(characterMatches(chars[0], tank, { q: "tank" }), true);
    assert.equal(characterMatches(chars[0], tank, { q: "healer" }), false);
    assert.equal(characterMatches(chars[2], null, { q: "bakes" }), true);
  });

  it("filters by class, race, and role id", () => {
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
      ["b"],
    );
    assert.deepEqual(
      filterCharacters(chars, roles, assignments, { role: "none" }).map((c) => c.id),
      ["c"],
    );
  });
});
