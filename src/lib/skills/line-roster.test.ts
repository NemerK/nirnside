import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SkillLine } from "../snapshot/schema";
import { skillLineRoster, type RosterCharacter, type RosterSkill } from "./line-roster";

const assassination: RosterSkill[] = [
  {
    id: "sk-assassins-blade",
    name: "Assassin's Blade",
    type: "active",
    morphs: ["Killer's Blade", "Impale"],
  },
  {
    id: "sk-master-assassin",
    name: "Master Assassin",
    type: "passive",
    morphs: [],
  },
];

function character(partial: {
  id: string;
  name: string;
  className: string;
  archivedAt?: number;
  lines?: Parameters<typeof SkillLine.parse>[0][];
}): RosterCharacter {
  return {
    id: partial.id,
    name: partial.name,
    className: partial.className,
    archivedAt: partial.archivedAt,
    skillLines: (partial.lines ?? []).map((line) => SkillLine.parse(line)),
  };
}

describe("skillLineRoster", () => {
  const nightblade = character({
    id: "nb",
    name: "Sings-With-Shadows",
    className: "Nightblade",
    lines: [
      {
        name: "Assassination",
        category: "Class",
        rank: 50,
        abilities: [
          {
            name: "Killer's Blade",
            rank: 4,
            morph: 1,
            purchased: true,
            morphs: [
              { slot: 0, name: "Assassin's Blade", rank: 4, purchased: true },
              { slot: 1, name: "Killer's Blade", rank: 4, purchased: true },
              { slot: 2, name: "Impale", rank: 4, purchased: false },
            ],
          },
          {
            name: "Master Assassin",
            rank: 2,
            purchased: true,
            passive: true,
            maxRank: 2,
          },
        ],
      },
      {
        name: "Herald of the Tome",
        category: "Class",
        rank: 38,
        subclassed: true,
        abilities: [],
      },
    ],
  });
  const dragonknight = character({
    id: "dk",
    name: "Draugr-Bane",
    className: "Dragonknight",
    lines: [{ name: "Ardent Flame", category: "Class", rank: 50, abilities: [] }],
  });
  const archived = character({
    id: "old",
    name: "Whispers-of-Moon",
    className: "Warden",
    archivedAt: 10,
    lines: [{ name: "Assault", category: "Alliance War", rank: 9, abilities: [] }],
  });

  it("lists every live character as not discovered when nobody has the line", () => {
    const rows = skillLineRoster(
      { name: "Assault", className: null, classMastery: false },
      [{ id: "sk-vigor", name: "Vigor", type: "active", morphs: ["Echoing Vigor", "Resolving Vigor"] }],
      [nightblade, dragonknight],
      10,
    );
    assert.deepEqual(
      rows.map((row) => row.state),
      ["undiscovered", "undiscovered"],
    );
    assert.equal(rows[0]?.cap, 10);
    assert.equal(rows[0]?.rank, null);
    assert.equal(rows[0]?.abilities.length, 0);
  });

  it("reads the purchased morph and leaves an unscanned ability unknown", () => {
    const rows = skillLineRoster(
      { name: "Assassination", className: "Nightblade", classMastery: false },
      [
        ...assassination,
        { id: "sk-teleport", name: "Teleport Strike", type: "active", morphs: ["Lotus Fan", "Ambush"] },
      ],
      [nightblade, dragonknight, archived],
      50,
    );
    assert.equal(rows.length, 2);
    const nb = rows[0];
    assert.equal(nb?.state, "learned");
    assert.equal(nb?.rank, 50);
    assert.equal(nb?.cap, 50);
    const blade = nb?.abilities.find((ability) => ability.name === "Assassin's Blade");
    assert.equal(blade?.known, true);
    assert.equal(blade?.face, "Killer's Blade");
    assert.equal(blade?.rankLabel, "IV");
    const passive = nb?.abilities.find((ability) => ability.name === "Master Assassin");
    assert.equal(passive?.rankLabel, "II");
    const missing = nb?.abilities.find((ability) => ability.name === "Teleport Strike");
    assert.equal(missing?.inSnapshot, false);
    assert.equal(missing?.known, false);
    assert.equal(rows[1]?.state, "other-class");
    assert.equal(rows[1]?.abilities.length, 0);
  });

  it("keeps a subclassed line on a character of another class", () => {
    const rows = skillLineRoster(
      { name: "Herald of the Tome", className: "Arcanist", classMastery: false },
      [],
      [nightblade, dragonknight],
      50,
    );
    assert.equal(rows[0]?.state, "learned");
    assert.equal(rows[0]?.subclassed, true);
    assert.equal(rows[0]?.rank, 38);
    assert.equal(rows[1]?.state, "other-class");
  });

  it("counts Class Mastery points and does not treat another class's line as this one", () => {
    const nb = character({
      id: "nb",
      name: "Sings-With-Shadows",
      className: "Nightblade",
      lines: [
        {
          name: "Class Mastery",
          category: "Class",
          className: "Nightblade",
          classMastery: true,
          rank: 0,
          abilities: [
            { name: "Nocturnal Inspiration", purchased: true, passive: true, rank: 0 },
            { name: "An Eye for Exploitation", purchased: false, passive: true, rank: 0 },
          ],
        },
      ],
    });
    const dk = character({
      id: "dk",
      name: "Draugr-Bane",
      className: "Dragonknight",
      lines: [
        {
          name: "Class Mastery",
          category: "Class",
          className: "Dragonknight",
          classMastery: true,
          rank: 0,
          abilities: [{ name: "Booming Voice", purchased: true, passive: true, rank: 0 }],
        },
      ],
    });
    const rows = skillLineRoster(
      { name: "Class Mastery", className: "Nightblade", classMastery: true },
      [{ id: "cm-1", name: "Nocturnal Inspiration", type: "passive", morphs: [] }],
      [nb, dk],
      2,
    );
    assert.equal(rows[0]?.state, "learned");
    assert.equal(rows[0]?.points, 1);
    assert.equal(rows[0]?.rank, null);
    assert.equal(rows[0]?.cap, 2);
    assert.equal(rows[0]?.abilities[0]?.known, true);
    assert.equal(rows[0]?.abilities[0]?.rankLabel, null);
    assert.equal(rows[1]?.state, "other-class");
  });

  it("does not call an unpurchased skill purchased", () => {
    const rows = skillLineRoster(
      { name: "Assassination", className: "Nightblade", classMastery: false },
      assassination,
      [
        character({
          id: "nb",
          name: "Sings-With-Shadows",
          className: "Nightblade",
          lines: [
            {
              name: "Assassination",
              category: "Class",
              rank: 12,
              abilities: [
                {
                  name: "Assassin's Blade",
                  rank: 0,
                  purchased: false,
                  morphs: [
                    { slot: 0, name: "Assassin's Blade", rank: 0, purchased: false },
                    { slot: 1, name: "Killer's Blade", rank: 0, purchased: false },
                  ],
                },
              ],
            },
          ],
        }),
      ],
      50,
    );
    const blade = rows[0]?.abilities[0];
    assert.equal(blade?.inSnapshot, true);
    assert.equal(blade?.known, false);
    assert.equal(blade?.face, null);
  });
});
