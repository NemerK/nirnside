import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { livingHome, type LivingCap } from "./living";
import type { Character } from "../snapshot/schema";

const cap: LivingCap = (name) => {
  const known: Record<string, number> = {
    "Herald of the Tome": 50,
    Assassination: 50,
    "Draconic Power": 50,
  };
  return known[name] ?? null;
};

function character(partial: Partial<Character> & Pick<Character, "id" | "name">): Character {
  return {
    class: "Nightblade",
    race: "Khajiit",
    alliance: "Aldmeri Dominion",
    gender: null,
    level: 50,
    championPoints: 3600,
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
    wardrobe: null,
    lastSeen: null,
    gold: 0,
    telVar: 0,
    alliancePoints: 0,
    dailies: null,
    archivedAt: null,
    ...partial,
  };
}

describe("living home", () => {
  it("faces the character who logged out most recently", () => {
    const home = livingHome(
      [
        character({ id: "old", name: "Draugr-Bane", lastSeen: 10 }),
        character({ id: "new", name: "Sings-With-Shadows", lastSeen: 20 }),
      ],
      [],
      cap,
    );
    assert.equal(home.faceId, "new");
    assert.deepEqual(
      home.faces.map((face) => face.name),
      ["Draugr-Bane", "Sings-With-Shadows"],
    );
  });

  it("shows an unfinished subclass against its real cap, and does not invent one", () => {
    const home = livingHome(
      [
        character({
          id: "sings",
          name: "Sings-With-Shadows",
          skillLines: [
            { name: "Assassination", category: "Class", rank: 50, subclassed: false, classMastery: false, abilities: [] },
            { name: "Herald of the Tome", category: "Class", rank: 38, subclassed: true, classMastery: false, abilities: [] },
            { name: "Unlisted Line", category: "Guild", rank: 4, subclassed: false, classMastery: false, abilities: [] },
          ],
        }),
      ],
      [],
      cap,
    );
    assert.deepEqual(home.faces[0]?.progress, { label: "Herald of the Tome", rank: 38, total: 50 });
  });

  it("uses level only before 50, when no skill line is still climbing", () => {
    const home = livingHome(
      [character({ id: "bakes", name: "Bakes-Sweet-Rolls", class: "Arcanist", level: 32, championPoints: 0 })],
      [],
      cap,
    );
    assert.deepEqual(home.faces[0]?.progress, { label: "Level", rank: 32, total: 50 });
  });

  it("names an accepted daily, and a character who has never logged out", () => {
    const withQuest = livingHome(
      [
        character({
          id: "sings",
          name: "Sings-With-Shadows",
          lastSeen: 20,
          dailies: {
            dayKey: "2025-09-13",
            resetAt: 1,
            capturedAt: 1,
            randomNormal: { status: "unknown" },
            randomVeteran: { status: "unknown" },
            writs: [],
            pledges: [],
            worldBosses: [],
            zoneDailies: [{ zone: "summerset", kind: "event", questId: 6166, name: "Sinking Summerset", status: "accepted" }],
            zoneDailiesKnown: true,
          },
        }),
      ],
      [],
      cap,
    );
    assert.equal(withQuest.faces[0]?.open, "Sinking Summerset is accepted and not finished.");
    assert.deepEqual(withQuest.faces[0]?.activity, { title: "Sinking Summerset", detail: "Accepted and not finished" });

    const unseen = livingHome([character({ id: "bakes", name: "Bakes-Sweet-Rolls" })], [], cap);
    assert.equal(unseen.faces[0]?.open, "Has not logged out since the addon was installed.");
  });

  it("names the primary house and the sets that are worn", () => {
    const home = livingHome(
      [
        character({
          id: "sings",
          name: "Sings-With-Shadows",
          equipped: [
            { slot: "Main Hand", bar: "front", name: "Coral Riptide Dagger", setName: "Coral Riptide", trait: null, enchant: null, scribing: [] },
            { slot: "Head", bar: null, name: "Slimecraw's Helm", setName: "Slimecraw", trait: null, enchant: null, scribing: [] },
            { slot: "Chest", bar: null, name: "Coral Riptide Jack", setName: "Coral Riptide", trait: null, enchant: null, scribing: [] },
          ],
        }),
      ],
      [
        { name: "Snugpod", location: "Grahtwood", primary: false },
        { name: "Grand Psijic Villa", location: "Artaeum", primary: true },
      ],
      cap,
    );
    assert.equal(home.house?.name, "Grand Psijic Villa");
    assert.equal(home.house?.location, "Artaeum");
    assert.equal(home.house?.others, 1);
    assert.equal(home.faces[0]?.wearing, "Wearing Coral Riptide and Slimecraw.");
    assert.deepEqual(home.faces[0]?.sets, ["Coral Riptide", "Slimecraw"]);
  });
});
