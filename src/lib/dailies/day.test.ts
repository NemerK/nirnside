import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { esoDayKey, formatRemainingSeconds, nextEsoResetAt, resetAtForDayKey } from "./day";

describe("ESO daily reset clock", () => {
  it("rolls the EU day at 03:00 UTC and the NA day at 10:00 UTC", () => {
    const euBefore = Date.UTC(2026, 9, 4, 2, 59, 0) / 1000;
    const euAt = Date.UTC(2026, 9, 4, 3, 0, 0) / 1000;
    assert.equal(esoDayKey(euBefore, "EU"), "2026-10-03");
    assert.equal(esoDayKey(euAt, "EU"), "2026-10-04");

    const naBefore = Date.UTC(2026, 9, 4, 9, 59, 0) / 1000;
    const naAt = Date.UTC(2026, 9, 4, 10, 0, 0) / 1000;
    assert.equal(esoDayKey(naBefore, "NA"), "2026-10-03");
    assert.equal(esoDayKey(naAt, "NA"), "2026-10-04");

    // 06:00 UTC is already tomorrow on EU and still yesterday on NA.
    const six = Date.UTC(2026, 9, 4, 6, 0, 0) / 1000;
    assert.equal(esoDayKey(six, "EU"), "2026-10-04");
    assert.equal(esoDayKey(six, "NA"), "2026-10-03");
  });

  it("defaults to the EU clock (this hub is EU-first)", () => {
    const six = Date.UTC(2026, 9, 4, 6, 0, 0) / 1000;
    assert.equal(esoDayKey(six), "2026-10-04");
    assert.equal(nextEsoResetAt(six), Date.UTC(2026, 9, 5, 3, 0, 0) / 1000);
  });

  it("points resetAt at the following megaserver hour", () => {
    assert.equal(resetAtForDayKey("2026-10-03", "EU"), Date.UTC(2026, 9, 4, 3, 0, 0) / 1000);
    assert.equal(resetAtForDayKey("2026-10-03", "NA"), Date.UTC(2026, 9, 4, 10, 0, 0) / 1000);
  });

  it("computes the next reset from a live timestamp", () => {
    const morning = Date.UTC(2026, 9, 4, 2, 0, 0) / 1000;
    const afternoon = Date.UTC(2026, 9, 4, 6, 0, 0) / 1000;
    assert.equal(nextEsoResetAt(morning, "EU"), Date.UTC(2026, 9, 4, 3, 0, 0) / 1000);
    assert.equal(nextEsoResetAt(afternoon, "EU"), Date.UTC(2026, 9, 5, 3, 0, 0) / 1000);
    assert.equal(nextEsoResetAt(afternoon, "NA"), Date.UTC(2026, 9, 4, 10, 0, 0) / 1000);
  });

  it("formats remaining cooldown like WPamA", () => {
    assert.equal(formatRemainingSeconds(7 * 3600 + 53 * 60), "7:53");
    assert.equal(formatRemainingSeconds(0), "0:00");
  });
});
