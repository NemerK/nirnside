import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TRACKED, changeTracking, normalizeTracking, trackedFor } from "./daily-tracking";


test("dungeons, writs and pledges are tracked until you choose", () => {
  const t = normalizeTracking(null);
  assert.deepEqual(trackedFor(t, "c1"), { keys: DEFAULT_TRACKED, own: false });
  assert.ok(DEFAULT_TRACKED.includes("random-veteran") && DEFAULT_TRACKED.includes("pledge-maj"));
  assert.ok(!DEFAULT_TRACKED.some((k) => k.startsWith("boss-")));
});

test("the account default applies to every character without their own list", () => {
  let t = changeTracking(normalizeTracking(null), { scope: "account", keys: ["random-veteran", "writ-clothing", "nope"] });
  assert.deepEqual(trackedFor(t, "c1"), { keys: ["random-veteran", "writ-clothing"], own: false });
  t = changeTracking(t, { scope: "character", characterId: "c2", keys: ["pledge-maj"] });
  assert.deepEqual(trackedFor(t, "c2"), { keys: ["pledge-maj"], own: true });
  assert.deepEqual(trackedFor(t, "c1").keys, ["random-veteran", "writ-clothing"]);
  t = changeTracking(t, { scope: "character", characterId: "c2", keys: null });
  assert.deepEqual(trackedFor(t, "c2"), { keys: ["random-veteran", "writ-clothing"], own: false });
});

test("the riding lesson is tracked by default", () => {
  assert.ok(DEFAULT_TRACKED.includes("riding"));
});
