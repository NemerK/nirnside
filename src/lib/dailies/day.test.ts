import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { esoDayKey, formatRemainingSeconds, nextEsoResetAt, resetAtForDayKey } from "./day";

describe("ESO daily reset clock", () => {
  it("rolls the day key at 10:00 UTC", () => {
    const before = Date.UTC(2026, 9, 3, 9, 59, 0) / 1000;
    const at = Date.UTC(2026, 9, 3, 10, 0, 0) / 1000;
    assert.equal(esoDayKey(before), "2026-10-02");
    assert.equal(esoDayKey(at), "2026-10-03");
  });

  it("points resetAt at the following 10:00 UTC", () => {
    assert.equal(resetAtForDayKey("2026-10-02"), Date.UTC(2026, 9, 3, 10, 0, 0) / 1000);
    assert.equal(resetAtForDayKey("2026-10-03"), Date.UTC(2026, 9, 4, 10, 0, 0) / 1000);
  });

  it("computes the next reset from a live timestamp", () => {
    const morning = Date.UTC(2026, 9, 3, 9, 0, 0) / 1000;
    const afternoon = Date.UTC(2026, 9, 3, 11, 0, 0) / 1000;
    assert.equal(nextEsoResetAt(morning), Date.UTC(2026, 9, 3, 10, 0, 0) / 1000);
    assert.equal(nextEsoResetAt(afternoon), Date.UTC(2026, 9, 4, 10, 0, 0) / 1000);
  });

  it("formats remaining cooldown like WPamA", () => {
    assert.equal(formatRemainingSeconds(7 * 3600 + 53 * 60), "7:53");
    assert.equal(formatRemainingSeconds(0), "0:00");
  });
});
