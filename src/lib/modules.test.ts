import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";

// A throwaway DB: module choices are player-authored local state and must
// never touch a real account database, in tests least of all. The modules under
// test load lazily so they see this path, not the default ./data one.
process.env.NIRNSIDE_DB = join(tmpdir(), `nirnside-modules-test-${process.pid}.db`);

type Modules = typeof import("./modules");
let mod: Modules;

before(async () => {
  mod = await import("./modules");
});

describe("module registry", () => {
  it("lists only toggleable modules, never Home or Setup", () => {
    const ids = mod.TOGGLEABLE_MODULES.map((m) => m.id);
    assert.ok(!ids.includes("home"));
    assert.ok(!ids.includes("setup"));
    assert.equal(new Set(ids).size, ids.length, "module ids are unique");
  });
});

describe("setDisabledModules", () => {
  it("round-trips a clean list", () => {
    mod.setDisabledModules([]);
    const saved = mod.setDisabledModules(["stickerbook", "dailies"]);
    assert.deepEqual(saved, ["dailies", "stickerbook"]);
    assert.deepEqual(mod.getDisabledModules(), ["dailies", "stickerbook"]);
    assert.equal(mod.isModuleEnabled("characters"), true);
    assert.equal(mod.isModuleEnabled("stickerbook"), false);
  });

  it("drops unknown, duplicated and non-string ids", () => {
    mod.setDisabledModules([]);
    const saved = mod.setDisabledModules(["stickerbook", "stickerbook", "nope", 42, null]);
    assert.deepEqual(saved, ["stickerbook"]);
  });

  it("accepts non-array garbage as an empty list", () => {
    const saved = mod.setDisabledModules("stickerbook");
    assert.deepEqual(saved, []);
    assert.deepEqual(mod.getDisabledModules(), []);
  });

  it("clearing shows everything again", () => {
    mod.setDisabledModules(["encyclopedia"]);
    assert.equal(mod.disabledModuleSet().size, 1);
    mod.setDisabledModules([]);
    assert.equal(mod.disabledModuleSet().size, 0);
  });
});
