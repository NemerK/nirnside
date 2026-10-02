import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { envFolders, isBundledSamplePath } from "./locate";

describe("bundled sample path", () => {
  it("recognizes the tour fixture on Windows and POSIX paths", () => {
    assert.equal(isBundledSamplePath("C:\\Users\\Nemer\\nirnside\\data\\sample\\Nirnside.lua"), true);
    assert.equal(isBundledSamplePath("/home/n/nirnside/data/sample/Nirnside.lua"), true);
    assert.equal(
      isBundledSamplePath(
        "C:\\Users\\Nemer\\OneDrive\\Documents\\Elder Scrolls Online\\live\\SavedVariables\\NirnsideSnapshot.lua",
      ),
      false,
    );
  });
});

describe("ESO env folder order", () => {
  it("prefers live over leftover liveeu", () => {
    const dir = mkdtempSync(join(tmpdir(), "nirnside-eso-"));
    mkdirSync(join(dir, "liveeu", "SavedVariables"), { recursive: true });
    mkdirSync(join(dir, "live", "SavedVariables"), { recursive: true });
    mkdirSync(join(dir, "pts", "SavedVariables"), { recursive: true });
    assert.deepEqual(envFolders(dir), ["live", "liveeu", "pts"]);
    rmSync(dir, { recursive: true, force: true });
  });
});
