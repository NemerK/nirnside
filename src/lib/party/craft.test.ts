import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { craftCoverage, whoCanCraft, type CraftSource } from "./craft";

function line(name: string, known: string[], all: string[]) {
  return { name, traits: all.map((t) => ({ name: t, known: known.includes(t), researching: false })) };
}

const ARMOR = ["Sturdy", "Impenetrable", "Reinforced", "Well-fitted", "Training", "Infused", "Invigorating", "Divines", "Nirnhoned"];

const sings: CraftSource = {
  id: "a",
  name: "Sings-With-Shadows",
  className: "Nightblade",
  research: {
    crafts: [
      {
        craft: "blacksmithing",
        name: "Blacksmithing",
        maxSlots: 3,
        lines: [line("Helm", ["Sturdy", "Impenetrable", "Reinforced", "Training", "Infused", "Divines"], ARMOR)],
      },
    ],
  },
};
const draugr: CraftSource = {
  id: "b",
  name: "Draugr-Bane",
  className: "Dragonknight",
  research: {
    crafts: [
      {
        craft: "blacksmithing",
        name: "Blacksmithing",
        maxSlots: 3,
        lines: [line("Helm", ARMOR, ARMOR), line("Sword", ["Powered", "Precise", "Infused", "Defending"], ["Powered", "Charged", "Precise", "Infused", "Defending", "Training", "Sharpened", "Decisive", "Nirnhoned"])],
      },
    ],
  },
};

describe("whoCanCraft", () => {
  it("lists everyone with enough traits, most traits first", () => {
    const rows = whoCanCraft([sings, draugr], 6, null);
    const helm = rows.find((r) => r.line === "Helm")!;
    assert.deepEqual(
      helm.can.map((c) => c.name),
      ["Draugr-Bane", "Sings-With-Shadows"],
    );
  });

  it("needs the asked-for trait researched as well", () => {
    const helm = whoCanCraft([sings, draugr], 6, "Nirnhoned").find((r) => r.line === "Helm")!;
    assert.deepEqual(
      helm.can.map((c) => c.name),
      ["Draugr-Bane"],
    );
  });

  it("names the closest character when nobody can make it yet", () => {
    const sword = whoCanCraft([sings, draugr], 6, null).find((r) => r.line === "Sword")!;
    assert.equal(sword.can.length, 0);
    assert.equal(sword.closest?.name, "Draugr-Bane");
    assert.equal(sword.closest?.missing, 2);
  });

  it("only reports lines some snapshot actually listed", () => {
    const rows = whoCanCraft([sings], 2, null);
    assert.deepEqual(
      rows.map((r) => r.line),
      ["Helm"],
    );
  });
});

describe("craftCoverage", () => {
  it("counts the pieces each character can make", () => {
    const research = (known: number) => ({
      crafts: [
        {
          craft: "blacksmithing",
          name: "Blacksmithing",
          lines: [
            { name: "Axe", traits: Array.from({ length: 9 }, (_, i) => ({ name: `T${i}`, known: i < known })) },
            { name: "Mace", traits: Array.from({ length: 9 }, (_, i) => ({ name: `T${i}`, known: i < 2 })) },
          ],
        },
      ],
    });
    const rows = whoCanCraft(
      [
        { id: "a", name: "A", className: "Templar", research: research(4) as never },
        { id: "b", name: "B", className: "Templar", research: research(1) as never },
      ],
      3,
      null,
    );
    const cov = craftCoverage(rows, ["a", "b"]);
    assert.deepEqual(cov.get("a"), { ok: 1, total: 2 });
    assert.deepEqual(cov.get("b"), { ok: 0, total: 2 });
    assert.equal(rows[0].cells.b.missing, 2);
  });
});
