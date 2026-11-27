import { test } from "node:test";
import assert from "node:assert/strict";
import { canSee, defaultProfile, normalizeProfile, STATUS_MAX } from "./profile";

test("a missing or broken profile becomes the default", () => {
  assert.deepEqual(normalizeProfile(null), defaultProfile());
  assert.deepEqual(normalizeProfile("nope"), defaultProfile());
});

test("unknown modules, duplicates and bad values are dropped or repaired", () => {
  const p = normalizeProfile({
    status: "  Farming   Slimecraw  ",
    mainCharacterId: "char-1",
    showcase: [
      { id: "houses", visibility: "friends", size: "full" },
      { id: "houses", visibility: "public", size: "half" },
      { id: "made-up" },
      { id: "treasury", visibility: "everyone!", size: "huge" },
    ],
  });
  assert.equal(p.status, "Farming Slimecraw");
  assert.equal(p.mainCharacterId, "char-1");
  assert.deepEqual(p.showcase, [
    { id: "houses", visibility: "friends", size: "full" },
    { id: "treasury", visibility: "private", size: "half" },
  ]);
});

test("status is capped", () => {
  assert.equal(normalizeProfile({ status: "x".repeat(500) }).status.length, STATUS_MAX);
});

test("friends see friends and public modules; everyone sees only public", () => {
  assert.equal(canSee("me", "private"), true);
  assert.equal(canSee("friend", "private"), false);
  assert.equal(canSee("friend", "friends"), true);
  assert.equal(canSee("public", "friends"), false);
  assert.equal(canSee("public", "public"), true);
});
