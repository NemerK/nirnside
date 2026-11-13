import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.NIRNSIDE_DB = join(tmpdir(), `nirnside-roster-order-${process.pid}.db`);

type Order = typeof import("./order");
let mod: Order;

before(async () => {
  mod = await import("./order");
});

describe("roster order", () => {
  it("keeps a saved order and appends characters that are new", () => {
    mod.setRosterOrder(["b", "a"]);
    const ordered = mod.applyRosterOrder(
      [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
      ],
      mod.getRosterOrder(),
    );
    assert.deepEqual(
      ordered.map((row) => row.id),
      ["b", "a", "c"],
    );
  });

  it("drops duplicates and non-strings", () => {
    const saved = mod.setRosterOrder(["a", "a", 4, "", "b"]);
    assert.deepEqual(saved, ["a", "b"]);
    assert.deepEqual(mod.getRosterOrder(), ["a", "b"]);
  });
});