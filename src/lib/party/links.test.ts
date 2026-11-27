import { test } from "node:test";
import assert from "node:assert/strict";
import { toPartyHref } from "./links";

test("Atlas addresses open the Party page for the same thing", () => {
  assert.equal(toPartyHref("/encyclopedia"), "/party/library");
  assert.equal(toPartyHref("/encyclopedia/sets/set-slimecraw"), "/party/library/sets/set-slimecraw");
  assert.equal(toPartyHref("/encyclopedia/sets?search=Coral"), "/party/library/sets?search=Coral");
  assert.equal(toPartyHref("/characters/char-1"), "/party/c/char-1");
  assert.equal(toPartyHref("/characters/char-1?tab=equipped"), "/party/c/char-1");
  assert.equal(toPartyHref("/characters"), "/party/characters");
  assert.equal(toPartyHref("/inventory?search=kit"), "/party/inventory?search=kit");
  assert.equal(toPartyHref("/knowledge?char=x"), "/party/knowledge?char=x");
  assert.equal(toPartyHref("/stickerbook"), "/party/collections");
  assert.equal(toPartyHref("/houses"), "/party/collections?tab=houses");
  assert.equal(toPartyHref("/styles?q=a"), "/party/collections?tab=styles&q=a");
  assert.equal(toPartyHref("/planner"), "/party/planner");
  assert.equal(toPartyHref("/setup"), "/party/setup");
});

test("Party and unknown addresses are left alone", () => {
  assert.equal(toPartyHref("/party/planner"), "/party/planner");
  assert.equal(toPartyHref("/inventorying"), "/inventorying");
  assert.equal(toPartyHref("/api/icon?p=x"), "/api/icon?p=x");
  assert.equal(toPartyHref("/"), "/");
});
