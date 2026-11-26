import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatTimeLeft, tallyComplete, todayResearch } from "./present";

describe("todayResearch", () => {
  const base = {
    id: "c1",
    name: "Draugr-Bane",
    class: "Dragonknight",
    lastSeen: 1_000_000,
    research: {
      crafts: [
        {
          craft: "blacksmithing",
          name: "Blacksmithing",
          maxSlots: 3,
          lines: [
            {
              name: "Axe",
              traits: [
                { name: "Sharpened", known: false, researching: true, remainingSeconds: 7200 },
                { name: "Precise", known: true, researching: false },
              ],
            },
          ],
        },
        { craft: "clothier", name: "Clothier", maxSlots: 0, lines: [] },
      ],
    },
  };

  it("subtracts the time since the snapshot from each timer", () => {
    const [row] = todayResearch([base], 1_000_000 + 3600);
    assert.equal(row.running[0].remaining, 3600);
  });

  it("clamps finished timers to zero instead of going negative", () => {
    const [row] = todayResearch([base], 1_000_000 + 99_999);
    assert.equal(row.running[0].remaining, 0);
  });

  it("counts idle slots only for crafts that reported a slot count", () => {
    const [row] = todayResearch([base], 1_000_000);
    assert.equal(row.idle, 2);
  });

  it("skips characters that never logged out", () => {
    assert.deepEqual(todayResearch([{ ...base, lastSeen: null }], 1_000_000), []);
  });
});

describe("formatTimeLeft", () => {
  it("reads like a timer", () => {
    assert.equal(formatTimeLeft(null), "unknown");
    assert.equal(formatTimeLeft(0), "ready");
    assert.equal(formatTimeLeft(59), "1m");
    assert.equal(formatTimeLeft(3 * 3600 + 120), "3h 2m");
    assert.equal(formatTimeLeft(2 * 86400 + 4 * 3600), "2d 4h");
  });
});

describe("tallyComplete", () => {
  it("needs something known before calling it done", () => {
    assert.equal(tallyComplete({ done: 0, total: 0 }), false);
    assert.equal(tallyComplete({ done: 2, total: 2 }), true);
    assert.equal(tallyComplete({ done: 1, total: 2 }), false);
  });
});
