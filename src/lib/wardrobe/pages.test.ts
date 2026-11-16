import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { WardrobePage, WardrobeZone } from "../snapshot/schema";
import { visibleWardrobePages, wardrobePageTitle } from "./pages";

function page(partial: Partial<WardrobePage> & Pick<WardrobePage, "name">): WardrobePage {
  return { setups: [], ...partial };
}

function zone(pages: WardrobePage[]): WardrobeZone {
  return { tag: "GEN", name: "General", pages };
}

describe("wardrobe pages", () => {
  it("keeps the saved name and orders pages by their addon id", () => {
    const pages = visibleWardrobePages(
      zone([
        page({ id: 2, name: "DPS", setups: [{ name: "Single Target", gear: [], bars: [], cp: [], food: null }] }),
        page({ id: 1, name: "Tank", setups: [{ name: "Trash", gear: [], bars: [], cp: [], food: null }] }),
      ]),
    );
    assert.deepEqual(
      pages.map((p) => p.name),
      ["Tank", "DPS"],
    );
    assert.equal(wardrobePageTitle(pages[0]!, 0), "Tank");
  });

  it("uses the addon default only when a page was never named", () => {
    assert.equal(wardrobePageTitle(page({ id: 3, name: "" }), 0), "Page 3");
    assert.equal(wardrobePageTitle(page({ name: "  " }), 1), "Page 2");
  });

  it("keeps a named page even when it has no setups", () => {
    const pages = visibleWardrobePages(zone([page({ id: 4, name: "Portal" })]));
    assert.deepEqual(
      pages.map((p) => p.name),
      ["Portal"],
    );
  });
});
