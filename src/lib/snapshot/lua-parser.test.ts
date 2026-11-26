import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseLua } from "./lua-parser";

describe("parseLua", () => {
  it("reads ESO's explicit-index lists as arrays", () => {
    assert.deepEqual(parseLua('X = { [1] = "a", [2] = "b", }').X, ["a", "b"]);
  });

  it("reads out-of-order numeric keys as a list in index order", () => {
    assert.deepEqual(parseLua('X = { [2] = "b", [1] = "a" }').X, ["a", "b"]);
  });

  it("keeps string keys as an object, and positional values after them numbered", () => {
    assert.deepEqual(parseLua('X = { name = "n", ["k"] = 1, "p" }').X, { name: "n", k: 1, "1": "p" });
  });

  it("lets a later positional value replace an explicit [1]", () => {
    assert.deepEqual(parseLua('X = { [1] = "a", "b" }').X, ["b"]);
  });

  it("reads empty tables as empty lists", () => {
    assert.deepEqual(parseLua("X = {}").X, []);
  });

  it("decodes escapes, both quote styles, and long strings", () => {
    const v = parseLua(`X = { [1] = "a\\"b\\\\c\\nd", [2] = 'it\\'s', [3] = [[\nline one\nline two]], [4] = [==[ ]] ]==] }`).X;
    assert.deepEqual(v, ['a"b\\c\nd', "it's", "line one\nline two", " ]] "]);
  });

  it("reads numbers, hex, booleans and nil", () => {
    assert.deepEqual(parseLua("X = { 12, -1.5, 0xFF, true, false, nil }").X, [12, -1.5, 255, true, false, null]);
  });

  it("skips line and block comments and odd whitespace", () => {
    assert.deepEqual(parseLua("-- head\nX = { --[[ block ]] 1, -- tail\n 2 }").X, [1, 2]);
  });

  it("reads several top-level variables", () => {
    const out = parseLua('A = { 1 }\nB = { b = "x" }');
    assert.deepEqual(out, { A: [1], B: { b: "x" } });
  });
});
