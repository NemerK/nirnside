import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { windowsKnownDocumentDirs } from "./windows-known-folders";

describe("windows known document folders", () => {
  it("is empty on non-Windows and only returns folders that exist on Windows", () => {
    const dirs = windowsKnownDocumentDirs();
    if (process.platform !== "win32") {
      assert.deepEqual(dirs, []);
      return;
    }
    assert.ok(dirs.length > 0);
    for (const dir of dirs) assert.ok(existsSync(dir));
  });
});
