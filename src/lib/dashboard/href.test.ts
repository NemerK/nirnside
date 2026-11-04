import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dashboardHref, isDashboardSection, isTargetDomain } from "./href";

describe("dashboard links", () => {
  it("opens a character on a section and keeps roster sort", () => {
    assert.equal(
      dashboardHref({ sort: "roster", char: "char-002", section: "crafting" }),
      "/dashboard?sort=roster&char=char-002&section=crafting",
    );
  });

  it("adds a target domain only on the targets section", () => {
    assert.equal(
      dashboardHref({ char: "char-002", section: "targets", domain: "ability" }),
      "/dashboard?char=char-002&section=targets&domain=ability",
    );
    assert.equal(
      dashboardHref({ char: "char-002", section: "skills", domain: "ability" }),
      "/dashboard?char=char-002&section=skills",
    );
  });

  it("returns the plain dashboard when nothing is selected", () => {
    assert.equal(dashboardHref({ sort: "progress" }), "/dashboard");
  });

  it("recognizes the live sections and target domains", () => {
    assert.equal(isDashboardSection("knowledge"), true);
    assert.equal(isDashboardSection("focus"), false);
    assert.equal(isTargetDomain("script"), true);
    assert.equal(isTargetDomain("crafting"), false);
  });
});
