import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { browsePlaces, defaultBrowsePath } from "./browse";
import { seesWindowsDocuments, windowsMountRoots } from "../snapshot/locate";

describe("setup browse start", () => {
  it("prefers Documents over a bare home directory", () => {
    const start = defaultBrowsePath();
    const docs = join(homedir(), "Documents");
    if (existsSync(docs)) assert.notEqual(start, homedir());
    assert.ok(start.length > 0);
  });

  it("lists only folders that exist on this machine", () => {
    for (const place of browsePlaces()) {
      assert.ok(place.label.length > 0);
      assert.ok(existsSync(place.path));
    }
  });

  it("only reports Windows Documents when a Users tree is actually visible", () => {
    assert.ok(Array.isArray(windowsMountRoots()));
    if (process.platform !== "win32" && windowsMountRoots().length === 0) {
      assert.equal(seesWindowsDocuments(), false);
    }
  });
});
