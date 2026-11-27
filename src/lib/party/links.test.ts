import { test } from "node:test";
import assert from "node:assert/strict";
import { toPartyHref } from "./links";

test("Atlas addresses open the Party page for the same thing", () => {
  assert.equal(toPartyHref("/encyclopedia"), "/party/library");
  assert.equal(toPartyHref("/encyclopedia/sets/set-slimecraw"), "/party/library/sets/set-slimecraw");
  assert.equal(toPartyHref("/encyclopedia/sets?search=Coral"), "/party/library/sets?search=Coral");
  assert.equal(toPartyHref("/characters/char-1"), "/party/c/char-1");
  assert.equal(toPartyHref("/characters/char-1?tab=equipped"), "/party/c/char-1");
  assert.equal(toPartyHref("/inventory?search=kit"), "/party/vault/inventory?search=kit");
  assert.equal(toPartyHref("/knowledge?char=x"), "/party/vault/crafting?char=x");
  assert.equal(toPartyHref("/setup"), "/party/setup");
});

test("Party and unknown addresses are left alone", () => {
  assert.equal(toPartyHref("/party/compare"), "/party/compare");
  assert.equal(toPartyHref("/inventorying"), "/inventorying");
  assert.equal(toPartyHref("/api/icon?p=x"), "/api/icon?p=x");
  assert.equal(toPartyHref("/"), "/");
});
