import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Character } from "../snapshot/schema";
import {
  overallWorkspacePct,
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
    assert.equal(overallWorkspacePct(card), 0);
  });

  it("maps a scanned character without inventing progress", () => {
    const cards = presentCharacterWorkspaceCards([char({ id: "c2", name: "Alive", lastSeen: 100 })], [], {});
    assert.equal(cards.length, 1);
    assert.equal(cards[0]!.unknown, false);
    assert.equal(cards[0]!.name, "Alive");
  });
});
