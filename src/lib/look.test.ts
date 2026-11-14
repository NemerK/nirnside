import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isLook, lookCookieAssignment, normalizeLook } from "./look";

describe("normalizeLook", () => {
  it("keeps classic and atlas", () => {
    assert.equal(normalizeLook("classic"), "classic");
    assert.equal(normalizeLook("atlas"), "atlas");
  });

  it("falls back to classic for unknown values", () => {
    assert.equal(normalizeLook(undefined), "classic");
    assert.equal(normalizeLook(null), "classic");
    assert.equal(normalizeLook("noir"), "classic");
    assert.equal(normalizeLook(1), "classic");
  });
});

describe("look cookie", () => {
  it("writes a year-long same-site cookie the server can read", () => {
    assert.equal(
      lookCookieAssignment("atlas"),
      "nirnside-look=atlas; Path=/; Max-Age=31536000; SameSite=Lax",
    );
  });
});
describe("isLook", () => {
  it("narrows only the two known looks", () => {
    assert.equal(isLook("classic"), true);
    assert.equal(isLook("atlas"), true);
    assert.equal(isLook("Classic"), false);
  });
});
