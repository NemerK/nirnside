import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { goalBarSegments, goalMarkMeasures } from "./bar";
import type { Goal, LineProgress } from "./types";

const line = (patch: Partial<Goal> = {}): Pick<Goal, "domain" | "targetRank" | "extraRank"> => ({
  domain: "skillline",
  targetRank: 50,
  extraRank: 0,
  ...patch,
});

describe("goalMarkMeasures", () => {
  it("fills a finished skill line to its mandatory rank", () => {
    const measures = goalMarkMeasures({ state: "done", rank: 50 }, line());
    assert.deepEqual(measures, { rank: 50, scale: 50, mandatory: 50, extra: 0 });
    assert.deepEqual(goalBarSegments({ state: "done", ...measures }), { gold: 1, blue: 0, split: 1 });
  });

  it("paints gold up to mandatory and blue only past it", () => {
    const measures = goalMarkMeasures({ state: "short", rank: 45 }, line({ targetRank: 40, extraRank: 50 }));
    assert.equal(measures.scale, 50);
    assert.deepEqual(goalBarSegments({ state: "short", ...measures }), { gold: 0.8, blue: 0.1, split: 0.8 });
  });

  it("leaves an unscanned character as an empty track", () => {
    const measures = goalMarkMeasures({ state: "unknown" }, line());
    assert.equal(measures.rank, null);
    assert.equal(goalBarSegments({ state: "unknown", ...measures }), null);
  });

  it("draws an undiscovered line as rank 0, not as missing data", () => {
    const measures = goalMarkMeasures({ state: "undiscovered" }, line({ targetRank: 10 }));
    assert.deepEqual(goalBarSegments({ state: "undiscovered", ...measures }), { gold: 0, blue: 0, split: 1 });
  });

  it("uses the ability rank against its own target", () => {
    const progress: LineProgress = { state: "short", rank: 2, targetRank: 4 };
    const measures = goalMarkMeasures(progress, { domain: "ability", targetRank: 0, extraRank: 0 });
    assert.deepEqual(goalBarSegments({ state: "short", ...measures }), { gold: 0.5, blue: 0, split: 1 });
  });

  it("treats a known script as a full bar and an unknown script as empty", () => {
    const known = goalMarkMeasures({ state: "done", rank: 0 }, { domain: "script", targetRank: 0, extraRank: 0 });
    assert.deepEqual(goalBarSegments({ state: "done", ...known }), { gold: 1, blue: 0, split: 1 });
    const unseen = goalMarkMeasures({ state: "unknown" }, { domain: "script", targetRank: 0, extraRank: 0 });
    assert.equal(goalBarSegments({ state: "unknown", ...unseen }), null);
  });
});
