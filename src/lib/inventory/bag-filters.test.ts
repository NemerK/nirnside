import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BAG_CATEGORIES, tallyBagFilters } from "./bag-filters";

describe("bag filters", () => {
  it("follows the backpack tab order, with weapon subs under weapons", () => {
    assert.deepEqual(
      BAG_CATEGORIES.map((row) => row.id),
      [
        "weapons",
        "apparel",
        "jewelry",
        "consumables",
        "materials",
        "furnishings",
        "companion",
        "miscellaneous",
        "junk",
      ],
    );
    assert.deepEqual(
      BAG_CATEGORIES[0]?.subs.map((row) => row.id),
      ["one-handed", "two-handed", "bow", "destruction-staff", "restoration-staff"],
    );
  });

  it("counts a classified stack under its tab and subfilter", () => {
    const { counts } = tallyBagFilters([
      { bagCategory: "weapons", bagSubtype: "bow" },
      { bagCategory: "weapons", bagSubtype: "one-handed" },
      { bagCategory: null },
    ]);
    assert.equal(counts.weapons?.total, 2);
    assert.equal(counts.weapons?.subs.bow, 1);
    assert.equal(counts.apparel?.total, 0);
  });
});