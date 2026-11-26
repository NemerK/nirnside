import { test } from "node:test";
import assert from "node:assert/strict";
import { characterPathForSection } from "./legacy-links";

test("old dashboard links land on the matching character page", () => {
  assert.equal(characterPathForSection(null, null), "/characters");
  assert.equal(characterPathForSection("char-002", null), "/characters/char-002");
  assert.equal(characterPathForSection("char-002", "skills"), "/characters/char-002");
  assert.equal(characterPathForSection("char-002", "champion"), "/characters/char-002?tab=cp");
  assert.equal(characterPathForSection("char-002", "targets"), "/characters/char-002?tab=targets");
  assert.equal(characterPathForSection("char-002", "crafting"), "/knowledge?char=char-002");
});
