import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ChampionStar } from "../snapshot/schema";
import { alignChampionDisciplines, groupChampionStars, type ChampionStarView } from "./champion";

function star(partial: Partial<ChampionStarView> & Pick<ChampionStarView, "name">): ChampionStarView {
  return { points: 50, slotted: false, ...partial };
}

describe("groupChampionStars", () => {
  it("puts slotted stars on the circle the bar recorded and leaves the rest open", () => {
    const groups = groupChampionStars([
      star({ name: "Deadly Aim", slotted: true, slot: 1, kind: "slottable" }),
      star({ name: "Master-at-Arms", slotted: true, slot: 3, kind: "slottable" }),
      star({ name: "Wrathful Strikes", kind: "slottable" }),
      star({ name: "Piercing", points: 10, kind: "passive" }),
    ]);

    assert.equal(groups.equipped[0]?.name, "Deadly Aim");
    assert.equal(groups.equipped[1], null);
    assert.equal(groups.equipped[2]?.name, "Master-at-Arms");
    assert.equal(groups.equipped[3], null);
    assert.deepEqual(
      groups.unlocked.map((s) => s.name),
      ["Wrathful Strikes"],
    );
    assert.deepEqual(
      groups.passives.map((s) => s.name),
      ["Piercing"],
    );
    assert.equal(groups.barUnknown, false);
  });

  it("fills older snapshots from the left when the slot index was not saved", () => {
    const groups = groupChampionStars([
      star({ name: "Deadly Aim", slotted: true }),
      star({ name: "Master-at-Arms", slotted: true }),
      star({ name: "Backstabber", slotted: false }),
    ]);

    assert.deepEqual(
      groups.equipped.map((s) => s?.name ?? null),
      ["Deadly Aim", "Master-at-Arms", null, null],
    );
    assert.deepEqual(
      groups.unlocked.map((s) => s.name),
      ["Backstabber"],
    );
  });

  it("keeps passives out of the bar even when a catalog is the only kind we have", () => {
    const kinds = new Map([["piercing", "passive" as const]]);
    const groups = groupChampionStars(
      [star({ name: "Piercing", points: 20, slotted: true }), star({ name: "Deadly Aim", slotted: true })],
      kinds,
    );

    assert.equal(groups.equipped[0]?.name, "Deadly Aim");
    assert.deepEqual(
      groups.passives.map((s) => s.name),
      ["Piercing"],
    );
  });

  it("treats a snapshot with no slotted flags as an unknown bar", () => {
    const groups = groupChampionStars([
      star({ name: "Deadly Aim", kind: "slottable" }),
      star({ name: "Piercing", kind: "passive" }),
    ]);

    assert.deepEqual(groups.equipped, [null, null, null, null]);
    assert.deepEqual(
      groups.unlocked.map((s) => s.name),
      ["Deadly Aim"],
    );
    assert.equal(groups.barUnknown, true);
  });

  it("leaves constellation roots off every list", () => {
    const groups = groupChampionStars([
      star({ name: "Root", points: 15, kind: "cluster" }),
      star({ name: "Deadly Aim", slotted: true, slot: 1, kind: "slottable" }),
    ]);

    assert.equal(groups.equipped[0]?.name, "Deadly Aim");
    assert.deepEqual(groups.unlocked, []);
    assert.deepEqual(groups.passives, []);
  });
});

describe("alignChampionDisciplines", () => {
  const catalog = new Map<string, string>([
    ["deadly aim", "warfare"],
    ["steed's blessing", "craft"],
    ["boundless vitality", "fitness"],
  ]);

  it("moves the blue tree out of the green card and the green tree out of the blue card", () => {
    const aligned = alignChampionDisciplines(
      [
        { name: "Craft", stars: [{ name: "Deadly Aim" }, { name: "Unlisted Blue" }] },
        { name: "Warfare", stars: [{ name: "Steed's Blessing" }, { name: "Unlisted Green" }] },
        { name: "Fitness", stars: [{ name: "Boundless Vitality" }] },
      ],
      catalog,
    );

    assert.deepEqual(
      aligned.map((disc) => [disc.name, disc.stars.map((star) => star.name)]),
      [
        ["Craft", ["Steed's Blessing", "Unlisted Green"]],
        ["Warfare", ["Deadly Aim", "Unlisted Blue"]],
        ["Fitness", ["Boundless Vitality"]],
      ],
    );
  });

  it("leaves a snapshot that already matches the trees", () => {
    const disciplines = [
      { name: "Craft", stars: [{ name: "Steed's Blessing" }] },
      { name: "Warfare", stars: [{ name: "Deadly Aim" }] },
    ];
    assert.equal(alignChampionDisciplines(disciplines, catalog), disciplines);
  });
});

describe("ChampionStar", () => {
  it("keeps a slot and a kind, and ignores a slot that is not on the bar", () => {
    const kept = ChampionStar.parse({
      name: "Deadly Aim",
      points: 50,
      slotted: true,
      slot: 2,
      kind: "slottable",
    });
    assert.equal(kept.slot, 2);
    assert.equal(kept.kind, "slottable");

    const repaired = ChampionStar.parse({
      name: "Deadly Aim",
      points: 50,
      slotted: true,
      slot: 9,
      kind: "nope",
    });
    assert.equal(repaired.name, "Deadly Aim");
    assert.equal(repaired.slot, undefined);
    assert.equal(repaired.kind, undefined);
  });
});
