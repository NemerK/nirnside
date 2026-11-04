import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { CatalogBundle } from "./schema";

/** Same folding as NirnsideCatalog's slug(), so a later in-game scan hits the same id. */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

describe("scribing seed", () => {
  const bundle = CatalogBundle.parse(JSON.parse(readFileSync("data/catalog/scribing.json", "utf8")));

  it("uses the live script names and slots", () => {
    const names = new Map(bundle.scripts.map((s) => [s.name, s.slot]));
    assert.equal(names.get("Pull"), "focus");
    assert.equal(names.get("Class Flourish"), "signature");
    assert.equal(names.get("Berserk"), "affix");
    assert.equal(names.has("Ranged"), false);
    assert.equal(names.has("Class Mastery"), false);
    assert.equal(names.has("Minor Berserk"), false);
    assert.equal(names.has("Minor Force"), false);
    assert.equal([...names.values()].filter((s) => s === "focus").length, 21);
    assert.equal([...names.values()].filter((s) => s === "signature").length, 20);
    assert.equal([...names.values()].filter((s) => s === "affix").length, 26);
    for (const script of bundle.scripts) {
      assert.equal(script.source, "community");
      assert.equal(script.id, `scr-${slug(script.name)}`);
    }
  });

  it("lists the twelve live grimoires on their own skill lines", () => {
    const lines = new Map(bundle.grimoires.map((g) => [g.name, g.skillLine]));
    assert.equal(lines.size, 12);
    assert.equal(lines.get("Torchbearer"), "Fighters Guild");
    assert.equal(lines.get("Traveling Knife"), "Dual Wield");
    assert.equal(lines.get("Vault"), "Bow");
    assert.equal(lines.get("Mender's Bond"), "Restoration Staff");
    assert.equal(lines.get("Smash"), "Two Handed");
    assert.equal(lines.get("Soul Burst"), "Soul Magic");
    for (const grim of bundle.grimoires) {
      assert.equal(grim.source, "community");
      assert.equal(grim.id, `grim-${slug(grim.name)}`);
      assert.deepEqual(grim.focusScripts, []);
      assert.deepEqual(grim.signatureScripts, []);
      assert.deepEqual(grim.affixScripts, []);
    }
  });

  it("collects unlocked scripts from every grimoire slot, not only the scribed ones", () => {
    const lua = readFileSync("addon/NirnsideSnapshot/NirnsideSnapshot.lua", "utf8");
    const start = lua.indexOf("local function craftedScriptCollected(");
    const end = lua.indexOf("local function skillDataPurchased(");
    assert.ok(start >= 0 && end > start);
    const body = lua.slice(start, end);
    assert.match(body, /GetNumScriptsInSlotForCraftedAbility/);
    assert.match(body, /GetScriptIdAtSlotIndexForCraftedAbility/);
    assert.match(body, /IsCraftedAbilityScriptUnlocked/);
    assert.doesNotMatch(body, /GetNumCraftedAbilityScripts/);
    assert.match(body, /GetCraftedAbilityActiveScriptIds/);
    const catalog = readFileSync("addon/NirnsideCatalog/NirnsideCatalog.lua", "utf8");
    assert.match(catalog, /GetNumScriptsInSlotForCraftedAbility/);
    assert.doesNotMatch(catalog, /GetNumCraftedAbilityScripts/);
  });
});
