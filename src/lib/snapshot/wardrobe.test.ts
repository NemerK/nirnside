import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { loadSnapshotFromFile } from "./load";

describe("wizard's wardrobe snapshot", () => {
  const snap = loadSnapshotFromFile(resolve("data/sample/Nirnside.lua"));
  const sings = snap.characters.find((c) => c.id === "char-001");

  it("parses zones, named pages and setups for the character", () => {
    const w = sings?.wardrobe;
    assert.ok(w, "expected a wardrobe on char-001");
    const gen = w!.zones.find((z) => z.tag === "GEN");
    assert.ok(gen, "expected a GEN zone");
    assert.equal(gen!.name, "General");
    const pageNames = gen!.pages.map((p) => p.name);
    assert.deepEqual(pageNames, ["Tank", "DPS"]);
    const tank = gen!.pages.find((p) => p.name === "Tank")!;
    assert.deepEqual(
      tank.setups.map((s) => s.name),
      ["Trash", "Boss"],
    );
  });

  it("keeps gear with set names and marks mythics", () => {
    const tank = sings!.wardrobe!.zones.find((z) => z.tag === "GEN")!.pages.find((p) => p.name === "Tank")!;
    const trash = tank.setups.find((s) => s.name === "Trash")!;
    const mythic = trash.gear.find((g) => g.mythic);
    assert.equal(mythic?.setName, "Pale Order");
    assert.ok(trash.gear.some((g) => g.setName === "Nazaray"));
    assert.ok(trash.bars.some((b) => b.bar === "front" && b.skills.length > 0));
  });

  it("is null for a character without Wizard's Wardrobe", () => {
    const other = snap.characters.find((c) => c.id === "char-002");
    assert.equal(other?.wardrobe, null);
  });
});
