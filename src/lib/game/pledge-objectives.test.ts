import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inferPledgeMode, type PledgeObjective } from "./pledge-objectives";

function crypt(kind: "normal" | "vet" | "hm"): PledgeObjective[] {
  const required: PledgeObjective[] = [
    { text: "Kill Archmaster Siniel", done: true },
    { text: "Kill Death's Leviathan", done: true },
    { text: "Kill the Ilambris Twins", done: true },
  ];
  const veteran: PledgeObjective = {
    text: "Enter Crypt of Hearts I in Veteran Mode",
    done: kind !== "normal",
    hidden: true,
  };
  const optional: PledgeObjective = {
    text: "Read the Scroll of Glorious Battle and Then Kill the Twins",
    done: kind === "hm",
    optional: true,
  };
  if (kind === "normal") return [...required, veteran];
  return [...required, veteran, optional];
}

describe("inferPledgeMode", () => {
  it("reads a Normal clear: required kills done, Veteran-enter still open, no Death Challenge", () => {
    const mode = inferPledgeMode(crypt("normal"));
    assert.equal(mode.difficulty, "normal");
    assert.equal(mode.hardMode, false);
    assert.equal(mode.ready, true);
  });

  it("reads Veteran when the hidden enter-Veteran objective is done and HM is not", () => {
    const mode = inferPledgeMode(crypt("vet"));
    assert.equal(mode.difficulty, "veteran");
    assert.equal(mode.hardMode, false);
  });

  it("reads HM from the optional Death Challenge, even when the text never says hard mode", () => {
    const mode = inferPledgeMode(crypt("hm"));
    assert.equal(mode.difficulty, "veteran");
    assert.equal(mode.hardMode, true);
  });

  it("treats a visible Death Challenge as Veteran even if the hidden row is missing", () => {
    const mode = inferPledgeMode([
      { text: "Complete Frostvault", done: true },
      { text: "Use the Veracity Verifier before the Stonekeeper", done: false, optional: true },
    ]);
    assert.equal(mode.difficulty, "veteran");
    assert.equal(mode.hardMode, false);
  });

  it("does not treat an incomplete optional as unfinished combat (that was the checkmark bug)", () => {
    const mode = inferPledgeMode([
      { text: "Kill Stormreeve Neidir", done: true },
      { text: "Enter Tempest Island in Veteran Mode", done: false, hidden: true },
      { text: "Use the Scroll Before Killing the Stormreeve", done: false, optional: true },
    ]);
    // They entered? Optional is visible so this is Veteran, not a blank check.
    assert.equal(mode.difficulty, "veteran");
    assert.equal(mode.hardMode, false);
    assert.equal(mode.ready, true);
  });

  it("stays unknown while required bosses are still open", () => {
    const mode = inferPledgeMode([
      { text: "Kill Archmaster Siniel", done: true },
      { text: "Kill the Ilambris Twins", done: false },
    ]);
    assert.equal(mode.difficulty, null);
    assert.equal(mode.hardMode, null);
    assert.equal(mode.ready, false);
  });
});
