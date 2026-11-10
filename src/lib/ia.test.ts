import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { atlasItemVisible, type IaNavItem } from "./ia";

describe("atlasItemVisible", () => {
  it("always shows permanent items", () => {
    const item: IaNavItem = {
      id: "home",
      label: "Home",
      href: "/",
      blurb: "pulse",
      permanent: true,
    };
    assert.equal(atlasItemVisible(item, new Set(["home", "inventory"])), true);
  });

  it("hides a module when its id is off", () => {
    const item: IaNavItem = {
      id: "inventory",
      label: "Inventory",
      href: "/inventory",
      blurb: "bags",
    };
    assert.equal(atlasItemVisible(item, new Set(["inventory"])), false);
    assert.equal(atlasItemVisible(item, new Set()), true);
  });

  it("shows anyOf hubs when at least one child module is on", () => {
    const item: IaNavItem = {
      id: "collections",
      label: "Collections",
      href: "/collections",
      blurb: "sets styles houses",
      anyOf: ["stickerbook", "styles", "houses"],
    };
    assert.equal(atlasItemVisible(item, new Set(["stickerbook", "styles"])), true);
    assert.equal(atlasItemVisible(item, new Set(["stickerbook", "styles", "houses"])), false);
  });
});
