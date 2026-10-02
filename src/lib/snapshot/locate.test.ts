import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isBundledSamplePath, isIncomingPath } from "./locate";

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
