import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildWardrobeExport, wardrobeExportFilename } from "./export";
import type { WardrobeSetup } from "../snapshot/schema";

const setup: WardrobeSetup = {
  name: "Trash",
  gear: [{ slot: "Head", name: "Nazaray Helm", setName: "Nazaray", trait: "Sturdy", mythic: false }],
  bars: [{ bar: "front", skills: [{ name: "Pierce Armor" }] }],
  cp: ["Ironclad"],
  food: null,
};

describe("wardrobe export", () => {
  it("wraps a setup with self-describing metadata and a readable path", () => {
    const at = new Date("2026-09-22T12:00:00.000Z");
    const payload = buildWardrobeExport(
      "setup",
      setup,
      {
        character: { id: "char-001", name: "Sings-With-Shadows" },
        zone: { tag: "CR", name: "Cloudrest" },
        page: { name: "Tank" },
        setup: { name: "Trash" },
      },
      at,
    );
    assert.equal(payload.app, "Nirnside");
    assert.equal(payload.kind, "wizards-wardrobe");
    assert.equal(payload.version, 1);
    assert.equal(payload.scope, "setup");
    assert.equal(payload.exportedAt, "2026-09-22T12:00:00.000Z");
    assert.deepEqual(payload.path, { zone: "Cloudrest", zoneTag: "CR", page: "Tank", setup: "Trash" });
    assert.equal((payload.data as WardrobeSetup).name, "Trash");
  });

  it("builds filesystem-safe filenames per scope", () => {
    const ctx = {
      character: { id: "1", name: "Sings-With-Shadows" },
      zone: { tag: "CR", name: "Cloudrest" },
      page: { name: "Tank / DPS" },
      setup: { name: "Z'Maja" },
    };
    assert.equal(wardrobeExportFilename("wardrobe", ctx), "nirnside-sings-with-shadows-wardrobe.json");
    assert.equal(wardrobeExportFilename("zone", ctx), "nirnside-sings-with-shadows-wardrobe-cr.json");
    assert.equal(wardrobeExportFilename("page", ctx), "nirnside-sings-with-shadows-wardrobe-cr-tank-dps.json");
    assert.equal(wardrobeExportFilename("setup", ctx), "nirnside-sings-with-shadows-wardrobe-cr-tank-dps-z-maja.json");
  });
});
