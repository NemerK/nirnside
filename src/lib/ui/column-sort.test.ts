import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareSort, sortRows, statusRank, toggleSort } from "./column-sort";

describe("column sort", () => {
  it("cycles a column through ascending, descending, and the original order", () => {
    assert.deepEqual(toggleSort(null, "name"), { key: "name", dir: "asc" });
    assert.deepEqual(toggleSort({ key: "name", dir: "asc" }, "name"), { key: "name", dir: "desc" });
    assert.equal(toggleSort({ key: "name", dir: "desc" }, "name"), null);
    assert.deepEqual(toggleSort({ key: "name", dir: "asc" }, "qty"), { key: "qty", dir: "asc" });
  });

  it("sorts text and numbers, and keeps blanks at the bottom", () => {
    const rows = [
      { name: "B", qty: 2, trait: "" },
      { name: "A", qty: 10, trait: "Divines" },
      { name: "C", qty: 1, trait: null },
    ];
    assert.deepEqual(
      sortRows(rows, { key: "name", dir: "asc" }, (row, key) => row[key as "name"]).map((row) => row.name),
      ["A", "B", "C"],
    );
    assert.deepEqual(
      sortRows(rows, { key: "qty", dir: "desc" }, (row, key) => row[key as "qty"]).map((row) => row.qty),
      [10, 2, 1],
    );
    assert.deepEqual(
      sortRows(rows, { key: "trait", dir: "asc" }, (row, key) => row[key as "trait"]).map((row) => row.name),
      ["A", "B", "C"],
    );
    assert.ok(compareSort("Aerie", "Belharza", "asc") < 0);
    assert.equal(statusRank("done"), 5);
    assert.equal(statusRank("unknown"), null);
  });
});
