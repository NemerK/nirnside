import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  abilityProgress,
  goalAppliesTo,
  goalProgress,
  mergeLineMeta,
  progressLabel,
  scriptProgress,
  skillLineProgress,
  summarizeGoal,
  toGoalSubject,
} from "./progress";
import type { Goal, GoalIndexes, GoalSubject } from "./types";

function toon(
  id: string,
  name: string,
  opts: {
    className?: string;
    lastSeen?: number | null;
    lines?: { name: string; rank: number; abilities?: GoalSubject["skillLines"][number]["abilities"] }[];
    scripts?: string[];
    vampire?: boolean;
    werewolf?: boolean;
    roles?: string[];
    full?: boolean;
  } = {},
): GoalSubject {
  return {
    id,
    name,
    className: opts.className ?? "Necromancer",
    lastSeen: opts.lastSeen === undefined ? 1 : opts.lastSeen,
    skillLines: (opts.lines ?? []).map((l) => ({
      name: l.name,
      rank: l.rank,
      abilities: l.abilities ?? [],
    })),
    scribingScripts: opts.scripts ?? [],
    isVampire: opts.vampire ?? false,
    isWerewolf: opts.werewolf ?? false,
    roleIds: opts.roles ?? [],
    full: opts.full ?? true,
  };
}

const indexes: GoalIndexes = {
  lines: new Map([
    ["grave lord", { category: "Class", className: "Necromancer" }],
    ["ardeur", { category: "Class", className: "Nightblade" }],
    ["assault", { category: "Alliance War", className: null }],
    ["vampire", { category: "World", className: null }],
  ]),
  abilities: new Map([
    ["render soul", { lineName: "Grave Lord", category: "Class", className: "Necromancer" }],
    ["death stroke", { lineName: "Ardeur", category: "Class", className: "Nightblade" }],
  ]),
};

describe("skillLineProgress", () => {
  it("is unknown until that character has a snapshot", () => {
    const c = toon("a", "Unseen", { lastSeen: null, lines: [{ name: "Assault", rank: 10 }] });
    assert.equal(skillLineProgress(c, "Assault", 7).state, "unknown");
  });

  it("reports done and short by rank from the snapshot", () => {
    const c = toon("a", "PvPer", { lines: [{ name: "Assault", rank: 7 }] });
    assert.deepEqual(skillLineProgress(c, "Assault", 7), { state: "done", rank: 7 });
    assert.deepEqual(skillLineProgress(c, "assault", 10), { state: "short", rank: 7 });
  });

  it("never flags another class's line as missing", () => {
    const dk = toon("dk", "Knight", { className: "Dragonknight" });
    const p = skillLineProgress(dk, "Ardeur", 50, indexes);
    assert.equal(p.state, "notapplicable");
    assert.match(p.reason ?? "", /Nightblade/);
  });

  it("keeps a mandatory class line off a class that has not been scanned", () => {
    const unseen = toon("a", "Unseen", { className: "Dragonknight", lastSeen: null });
    const p = skillLineProgress(unseen, "Ardeur", 50, indexes);
    assert.equal(p.state, "notapplicable");
    assert.match(p.reason ?? "", /Nightblade/);
  });

  it("treats a missing own-class line as undiscovered, not missing", () => {
    const necro = toon("n", "Bones", { className: "Necromancer" });
    assert.equal(skillLineProgress(necro, "Grave Lord", 50, indexes).state, "undiscovered");
  });

  it("does not apply a subclassed line to a class that does not own it", () => {
    const dk = toon("dk", "Knight", {
      className: "Dragonknight",
      lines: [{ name: "Grave Lord", rank: 12 }],
    });
    const p = skillLineProgress(dk, "Grave Lord", 10, indexes);
    assert.equal(p.state, "notapplicable");
    assert.match(p.reason ?? "", /Necromancer/);
  });

  it("marks curse lines not applicable for characters without the curse", () => {
    const mortal = toon("m", "Mortal");
    const v = skillLineProgress(mortal, "Vampire", 10, indexes);
    assert.equal(v.state, "notapplicable");
    assert.match(v.reason ?? "", /Not a vampire/);

    const wolf = toon("w", "Wolf", { werewolf: true });
    assert.equal(skillLineProgress(wolf, "Vampire", 10, indexes).state, "notapplicable");

    const vampire = toon("v", "Fang", { vampire: true });
    assert.equal(skillLineProgress(vampire, "Vampire", 10, indexes).state, "undiscovered");
  });
});

describe("abilityProgress", () => {
  const withAbilities = toon("n", "Bones", {
    className: "Necromancer",
    lines: [
      {
        name: "Grave Lord",
        rank: 20,
        abilities: [
          {
            name: "Render Soul",
            purchased: true,
            rank: 4,
            morphNames: ["Render Flesh"],
            morphPurchased: [],
            morphs: [{ name: "Render Flesh", purchased: false, rank: null }],
          },
          {
            name: "Blastbones",
            purchased: false,
            rank: null,
            morphNames: ["Blighted Blastbones"],
            morphPurchased: [],
            morphs: [{ name: "Blighted Blastbones", purchased: false, rank: null }],
          },
        ],
      },
    ],
  });

  it("is done when the base is purchased at the live cap", () => {
    const p = abilityProgress(withAbilities, "Render Soul", indexes);
    assert.equal(p.state, "done");
    assert.equal(p.state === "done" ? p.rank : 0, 4);
    assert.equal(progressLabel(p, { domain: "ability" }), "Rank IV / IV");
  });

  it("is short when the purchased ability is below the cap", () => {
    const partial = toon("n", "Bones", {
      lines: [
        {
          name: "Grave Lord",
          rank: 20,
          abilities: [
            {
              name: "Render Soul",
              purchased: true,
              rank: 1,
              morphNames: [],
              morphPurchased: [],
            },
          ],
        },
      ],
    });
    const p = abilityProgress(partial, "Render Soul", indexes);
    assert.equal(p.state, "short");
    assert.equal(progressLabel(p, { domain: "ability" }), "Rank I / IV");
  });

  it("is done when the exact morph is owned at the asked rank", () => {
    const morphOwner = toon("n", "Bones", {
      lines: [
        {
          name: "Grave Lord",
          rank: 20,
          abilities: [
            {
              name: "Render Flesh",
              purchased: true,
              rank: 2,
              morphNames: ["Render Flesh"],
              morphPurchased: ["Render Flesh"],
              morphs: [
                { name: "Render Soul", purchased: false, rank: 4 },
                { name: "Render Flesh", purchased: true, rank: 2 },
                { name: "Reusable Parts", purchased: false, rank: 1 },
              ],
            },
          ],
        },
      ],
    });
    // The base's remembered IV does not finish the morph, and the other morph's rank stays its own.
    assert.equal(abilityProgress(morphOwner, "Render Flesh", indexes).state, "short");
    assert.equal(progressLabel(abilityProgress(morphOwner, "Render Flesh", indexes, 2), { domain: "ability" }), "Rank II / II");
    assert.equal(abilityProgress(morphOwner, "Render Flesh", indexes, 2).state, "done");
    const other = abilityProgress(morphOwner, "Reusable Parts", indexes);
    assert.equal(other.state, "short");
    assert.equal(progressLabel(other, { domain: "ability" }), "Rank I / IV · not purchased");
    const base = abilityProgress(morphOwner, "Render Soul", indexes);
    assert.equal(base.state, "short");
    assert.equal(progressLabel(base, { domain: "ability" }), "Rank IV · not purchased");
  });

  it("is done when a passive reaches its own cap, not IV", () => {
    const passive = toon("n", "Bones", {
      lines: [
        {
          name: "Grave Lord",
          rank: 20,
          abilities: [
            {
              name: "Reusable Parts",
              purchased: true,
              rank: 2,
              passive: true,
              maxRank: 2,
              morphNames: [],
              morphPurchased: [],
            },
          ],
        },
      ],
    });
    const atCap = abilityProgress(passive, "Reusable Parts", indexes, 4);
    assert.equal(atCap.state, "done");
    assert.equal(progressLabel(atCap, { domain: "ability" }), "Rank II / II");
    const low = toon("n", "Bones", {
      lines: [
        {
          name: "Grave Lord",
          rank: 20,
          abilities: [
            {
              name: "Reusable Parts",
              purchased: true,
              rank: 1,
              passive: true,
              maxRank: 2,
              morphNames: [],
              morphPurchased: [],
            },
          ],
        },
      ],
    });
    assert.equal(progressLabel(abilityProgress(low, "Reusable Parts", indexes), { domain: "ability" }), "Rank I / II");
  });

  it("treats a grimoire as unlocked, with no rank", () => {
    const scribe = toon("n", "Bones", {
      lines: [
        {
          name: "Soul Magic",
          rank: 6,
          abilities: [
            {
              name: "Soul Burst",
              purchased: true,
              rank: 0,
              crafted: true,
              morphNames: [],
              morphPurchased: [],
            },
          ],
        },
      ],
    });
    assert.equal(abilityProgress(scribe, "Soul Burst", indexes).state, "done");
    assert.equal(progressLabel(abilityProgress(scribe, "Soul Burst", indexes), { domain: "ability" }), "Learned");
  });

  it("reads ranks off the snapshot, including a morphed headline name", () => {
    const subject = toGoalSubject(
      {
        id: "a",
        name: "Bones",
        class: "Necromancer",
        lastSeen: 1,
        skillLines: [
          {
            name: "Grave Lord",
            rank: 20,
            abilities: [
              {
                name: "Render Flesh",
                rank: 2,
                purchased: true,
                morphs: [
                  { name: "Render Soul", purchased: false, rank: 4 },
                  { name: "Render Flesh", purchased: true, rank: 2 },
                  { name: "Reusable Parts", purchased: false, rank: null },
                ],
              },
            ],
          },
        ],
      },
      [],
      true,
    );
    assert.equal(abilityProgress(subject, "Render Flesh", indexes, 2).state, "done");
    assert.equal(abilityProgress(subject, "Render Soul").state, "short");
    const unseenMorph = abilityProgress(subject, "Reusable Parts");
    assert.equal(unseenMorph.state, "short");
    assert.equal(progressLabel(unseenMorph, { domain: "ability" }), "Not learned · IV");
  });

  it("is short when the ability exists but is not purchased", () => {
    assert.equal(abilityProgress(withAbilities, "Blastbones", indexes).state, "short");
  });

  it("is short when a morph exists but was not taken", () => {
    assert.equal(abilityProgress(withAbilities, "Render Flesh", indexes).state, "short");
    assert.equal(progressLabel(abilityProgress(withAbilities, "Render Flesh", indexes), { domain: "ability" }), "Not learned · IV");
  });

  it("never flags another class's ability as missing", () => {
    const dk = toon("dk", "Knight", { className: "Dragonknight" });
    const p = abilityProgress(dk, "Death Stroke", indexes);
    assert.equal(p.state, "notapplicable");
    assert.match(p.reason ?? "", /Nightblade/);
  });

  it("does not apply another class's ability even when this character has it", () => {
    const dk = toon("dk", "Knight", {
      className: "Dragonknight",
      lines: [
        {
          name: "Ardeur",
          rank: 50,
          abilities: [{ name: "Death Stroke", purchased: true, rank: 4, morphs: [], morphNames: [], morphPurchased: [] }],
        },
      ],
    });
    const p = abilityProgress(dk, "Death Stroke", indexes);
    assert.equal(p.state, "notapplicable");
    assert.match(p.reason ?? "", /Nightblade/);
  });

  it("keeps a mandatory class ability off an unscanned character of another class", () => {
    const unseen = toon("a", "Unseen", { className: "Arcanist", lastSeen: null });
    const p = abilityProgress(unseen, "Death Stroke", indexes);
    assert.equal(p.state, "notapplicable");
    assert.match(p.reason ?? "", /Nightblade/);
  });

  it("reads unknown on roster subjects without ability data", () => {
    const roster = toon("r", "Thin", { full: false, lines: [{ name: "Grave Lord", rank: 10 }] });
    assert.equal(abilityProgress(roster, "Render Soul", indexes).state, "unknown");
  });

  it("is unknown until that character has a snapshot", () => {
    const unseen = toon("u", "Unseen", { lastSeen: null });
    assert.equal(abilityProgress(unseen, "Render Soul", indexes).state, "unknown");
  });
});

describe("scriptProgress", () => {
  it("is done or short from the character's known scripts", () => {
    const s = toon("s", "Scribe", { scripts: ["Soul Sap"] });
    assert.equal(scriptProgress(s, "Soul Sap").state, "done");
    assert.equal(scriptProgress(s, "Vitalizing Garland").state, "short");
  });

  it("reads unknown for roster rows and unscanned characters", () => {
    assert.equal(scriptProgress(toon("r", "Thin", { full: false }), "Soul Sap").state, "unknown");
    assert.equal(scriptProgress(toon("u", "Unseen", { lastSeen: null }), "Soul Sap").state, "unknown");
  });
});

describe("mergeLineMeta", () => {
  it("keeps every class that owns a shared line name", () => {
    const merged = mergeLineMeta(
      { category: "Class", className: "Dragonknight", classNames: ["Dragonknight"] },
      { category: "Class", className: "Nightblade" },
    );
    assert.deepEqual(merged.classNames, ["Dragonknight", "Nightblade"]);
    const dk = toon("dk", "Knight", { className: "Dragonknight", lines: [{ name: "Class Mastery", rank: 1 }] });
    const nb = toon("nb", "Shade", { className: "Nightblade" });
    const warden = toon("w", "Grove", { className: "Warden" });
    const lines = new Map([["class mastery", merged]]);
    assert.equal(skillLineProgress(dk, "Class Mastery", 2, { lines }).state, "short");
    assert.equal(skillLineProgress(nb, "Class Mastery", 2, { lines }).state, "undiscovered");
    assert.equal(skillLineProgress(warden, "Class Mastery", 2, { lines }).state, "notapplicable");
  });
});

describe("goalAppliesTo", () => {
  const subject = toon("t", "Tanky", { className: "Dragonknight", roles: ["role-tank"] });

  it("applies account targets to everyone", () => {
    const goal: Goal = {
      id: "g",
      domain: "skillline",
      tier: "essential",
      scope: "account",
      characterId: null,
      scopeKey: null,
      target: "Assault",
      targetRank: 7,
      note: "",
      extraRank: 0,
      createdAt: 1,
    };
    assert.equal(goalAppliesTo(goal, subject), true);
    assert.equal(goalAppliesTo(goal, toon("x", "Other")), true);
  });

  it("applies role targets only to characters wearing the role", () => {
    const goal: Goal = {
      id: "g",
      domain: "ability",
      tier: "essential",
      scope: "role",
      characterId: null,
      scopeKey: "role-tank",
      target: "Pierce Armor",
      targetRank: 0,
      note: "",
      extraRank: 0,
      createdAt: 1,
    };
    assert.equal(goalAppliesTo(goal, subject), true);
    assert.equal(goalAppliesTo(goal, toon("h", "Heals", { roles: ["role-heal"] })), false);
  });

  it("applies class targets only to that class", () => {
    const goal: Goal = {
      id: "g",
      domain: "skillline",
      tier: "completionist",
      scope: "class",
      characterId: null,
      scopeKey: "Necromancer",
      target: "Grave Lord",
      targetRank: 50,
      note: "",
      extraRank: 0,
      createdAt: 1,
    };
    assert.equal(goalAppliesTo(goal, toon("n", "Bones")), true);
    assert.equal(goalAppliesTo(goal, subject), false);
  });

  it("applies character targets to one toon", () => {
    const goal: Goal = {
      id: "g",
      domain: "script",
      tier: "optional",
      scope: "character",
      characterId: "t",
      scopeKey: null,
      target: "Soul Sap",
      targetRank: 0,
      note: "",
      extraRank: 0,
      createdAt: 1,
    };
    assert.equal(goalAppliesTo(goal, subject), true);
    assert.equal(goalAppliesTo(goal, toon("x", "Other")), false);
  });
});

describe("summarizeGoal", () => {
  it("counts applicable characters only and dispatches by domain", () => {
    const goal: Goal = {
      id: "g",
      domain: "skillline",
      tier: "essential",
      scope: "account",
      characterId: null,
      scopeKey: null,
      target: "Assault",
      targetRank: 7,
      note: "",
      extraRank: 0,
      createdAt: 1,
    };
    const subjects = [
      toon("a", "Done", { lines: [{ name: "Assault", rank: 9 }] }),
      toon("b", "Short", { lines: [{ name: "Assault", rank: 3 }] }),
      toon("c", "Unseen", { lastSeen: null }),
    ];
    const s = summarizeGoal(goal, subjects, indexes);
    assert.equal(s.done, 1);
    assert.equal(s.total, 3);
    assert.equal(s.unknown, 1);
    assert.equal(s.rows.length, 3);
  });

  it("never counts cross-class characters as work", () => {
    const goal: Goal = {
      id: "g",
      domain: "skillline",
      tier: "essential",
      scope: "account",
      characterId: null,
      scopeKey: null,
      target: "Grave Lord",
      targetRank: 50,
      note: "",
      extraRank: 0,
      createdAt: 1,
    };
    const s = summarizeGoal(goal, [toon("n", "Bones"), toon("dk", "Knight", { className: "Dragonknight" })], indexes);
    assert.equal(s.total, 1);
    assert.equal(s.notApplicable, 1);
  });

  it("goalProgress dispatches by domain", () => {
    const lineGoal: Goal = {
      id: "g1",
      domain: "skillline",
      tier: "essential",
      scope: "account",
      characterId: null,
      scopeKey: null,
      target: "Assault",
      targetRank: 7,
      note: "",
      extraRank: 0,
      createdAt: 1,
    };
    const scriptGoal: Goal = { ...lineGoal, id: "g2", domain: "script", target: "Soul Sap", targetRank: 0 };
    const subject = toon("a", "Scribe", { lines: [{ name: "Assault", rank: 9 }], scripts: ["Soul Sap"] });
    assert.equal(goalProgress(lineGoal, subject, indexes).state, "done");
    assert.equal(goalProgress(scriptGoal, subject).state, "done");
  });

  it("treats mandatory as the rank that finishes a line, with extra above it", () => {
    const goal: Goal = {
      id: "g",
      domain: "skillline",
      tier: "essential",
      scope: "account",
      characterId: null,
      scopeKey: null,
      target: "Assault",
      targetRank: 7,
      extraRank: 10,
      note: "",
      createdAt: 1,
    };
    assert.equal(goalProgress(goal, toon("a", "Short", { lines: [{ name: "Assault", rank: 6 }] }), indexes).state, "short");
    assert.equal(goalProgress(goal, toon("b", "Met", { lines: [{ name: "Assault", rank: 8 }] }), indexes).state, "done");
    const onlyExtra: Goal = { ...goal, targetRank: 0, extraRank: 10, tier: "optional" };
    assert.equal(goalProgress(onlyExtra, toon("c", "Almost", { lines: [{ name: "Assault", rank: 9 }] }), indexes).state, "short");
    assert.equal(goalProgress(onlyExtra, toon("d", "Done", { lines: [{ name: "Assault", rank: 10 }] }), indexes).state, "done");
  });
});
