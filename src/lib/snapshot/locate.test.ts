import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { driveLettersFromPaths, isBundledSamplePath, isIncomingPath } from "./locate";

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

describe("windows drive letters", () => {
  it("only keeps the drives from the paths it is given, never A–Z by itself", () => {
    assert.deepEqual(
      driveLettersFromPaths(["C:\\Users\\Nemer\\OneDrive\\Documents", "C:\\Users\\Nemer", "/home/ubuntu", null]),
      ["C:\\"],
    );
    assert.deepEqual(driveLettersFromPaths(["D:\\Users\\Nemer", undefined, ""]), ["D:\\"]);
    assert.deepEqual(driveLettersFromPaths([undefined, ""]), []);
  });
});

describe("incoming drop-in path", () => {
  it("is only the data/incoming folder, not a real SavedVariables file", () => {
    assert.equal(isIncomingPath("C:\\Users\\Nemer\\nirnside\\data\\incoming\\NirnsideSnapshot.lua"), true);
    assert.equal(isIncomingPath("/tmp/nirnside/data/incoming/NirnsideSnapshot.lua"), true);
    assert.equal(
      isIncomingPath(
        "C:\\Users\\Nemer\\OneDrive\\Documents\\Elder Scrolls Online\\live\\SavedVariables\\NirnsideSnapshot.lua",
      ),
      false,
    );
  });
});

describe("frozen ESO path search", () => {
  it("keeps liveeu then live then pts, and does not walk A–Z by itself", () => {
    const src = readFileSync(resolve("src/lib/snapshot/locate.ts"), "utf8");
    assert.match(src, /const ESO_ENVS = \["liveeu", "live", "pts"\]/);
    assert.match(src, /Never walk A–Z/);
    assert.match(src, /turbopackIgnore: true/);
    const rule = readFileSync(resolve(".cursor/rules/eso-paths.mdc"), "utf8");
    assert.match(rule, /EU is often `live`/);
    assert.match(rule, /No later prompt unlocks this/);
  });
});
