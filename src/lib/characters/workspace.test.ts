import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Character, SkillLine } from "../snapshot/schema";
import type { Goal } from "../goals/types";
import {
  accountMandatory,
  mandatoryWorkspacePct,
  presentCharacterWorkspaceCard,
  presentCharacterWorkspaceCards,
} from "./workspace";

function char(partial: Partial<Character> & { id: string; name: string }): Character {
  return {
    class: "Nightblade",
    race: "Khajiit",
    alliance: "Aldmeri Dominion",
    gender: null,
    level: 50,
    championPoints: 0,
    mundus: null,
    attributes: {},
    vampire: { isVampire: false, stage: 0 },
    werewolf: { isWerewolf: false },
    classMastery: false,
    classMasteries: [],
    skillLines: [],
    champion: [],
    equipped: [],
    companions: [],
    scribingScripts: [],
    research: { crafts: [] },
    motifs: [],
    recipeLists: [],
    lastSeen: 1,
    gold: 0,
    telVar: 0,
    alliancePoints: 0,
    dailies: null,
    archivedAt: null,
    wardrobe: null,
    ...partial,
  };
}

describe("presentCharacterWorkspaceCard", () => {
  it("marks never-logged characters as unknown", () => {
    const card = presentCharacterWorkspaceCard(char({ id: "c1", name: "Ghost", lastSeen: null }), [], {});
    assert.equal(card.unknown, true);
    assert.equal(card.targets.total, 0);
    assert.equal(card.research.total, 0);
    assert.equal(card.motifs.total, 0);
    assert.equal(mandatoryWorkspacePct(card), 0);
  });

  it("maps a scanned character without inventing progress", () => {
    const cards = presentCharacterWorkspaceCards([char({ id: "c2", name: "Alive", lastSeen: 100 })], [], {});
    assert.equal(cards.length, 1);
    assert.equal(cards[0]!.unknown, false);
    assert.equal(cards[0]!.name, "Alive");
  });

  it("fills the list bar at the mandatory rank and ignores extras", () => {
    const line = (name: string, rank: number): SkillLine => ({
      name,
      category: "Alliance War",
      rank,
      subclassed: false,
      classMastery: false,
      abilities: [],
    });
    const essential: Goal = {
      id: "e",
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
    const extra: Goal = { ...essential, id: "x", tier: "optional", target: "Fighters Guild", targetRank: 10, extraRank: 0 };
    const card = presentCharacterWorkspaceCard(
      char({
        id: "c",
        name: "Tank",
        lastSeen: 5,
        skillLines: [line("Assault", 8), line("Fighters Guild", 1)],
      }),
      [essential, extra],
      {},
    );
    assert.equal(card.mandatoryTargets.done, 1);
    assert.equal(card.mandatoryTargets.total, 1);
    assert.equal(card.mandatoryTargets.pct, 100);
    assert.equal(card.beyond.done, 0);
    assert.equal(card.beyond.total, 2);
    assert.equal(card.targets.total, 2);
    card.motifs = { done: 1, total: 40, pct: 3 };
    card.research = { done: 10, total: 324, pct: 3 };
    assert.equal(mandatoryWorkspacePct(card), 100);
  });

  it("weights the account percentage by mandatory goals, not by character", () => {
    const line = (name: string, rank: number): SkillLine => ({
      name,
      category: "Guild",
      rank,
      subclassed: false,
      classMastery: false,
      abilities: [],
    });
    const goal = (id: string, target: string): Goal => ({
      id,
      domain: "skillline",
      tier: "essential",
      scope: "account",
      characterId: null,
      scopeKey: null,
      target,
      targetRank: 10,
      extraRank: 0,
      note: "",
      createdAt: 1,
    });
    const done = presentCharacterWorkspaceCard(
      char({ id: "a", name: "Done", lastSeen: 5, skillLines: [line("Mages Guild", 10)] }),
      [goal("m", "Mages Guild")],
      {},
    );
    const short = presentCharacterWorkspaceCard(
      char({
        id: "b",
        name: "Short",
        lastSeen: 5,
        skillLines: [line("Mages Guild", 1), line("Fighters Guild", 1), line("Undaunted", 1)],
      }),
      [goal("m", "Mages Guild"), goal("f", "Fighters Guild"), goal("u", "Undaunted")],
      {},
    );
    const account = accountMandatory([done, short]);
    assert.equal(account.done, 1);
    assert.equal(account.total, 4);
    assert.equal(account.pct, 25);
  });

  it("keeps assigned roles on the card", () => {
    const card = presentCharacterWorkspaceCard(
      char({ id: "c", name: "Tank", lastSeen: 5 }),
      [],
      {},
      ["r1", "missing"],
      [{ id: "r1", name: "Tank", color: "#3f7fd6", sortOrder: 0 }],
    );
    assert.deepEqual(
      card.roles.map((role) => role.name),
      ["Tank"],
    );
  });
});
