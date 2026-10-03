import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Character, CharacterDailies } from "../snapshot/schema";
import { resetAtForDayKey } from "./day";
import { isDailyScanStale, presentCharacterDailies } from "./present";

function char(dailies: CharacterDailies | null, lastSeen: number | null = 1): Character {
  return {
    id: "c1",
    name: "Ardent",
    class: "Dragonknight",
    race: "Nord",
    alliance: "Ebonheart Pact",
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
    research: [],
    lastSeen,
    gold: 0,
    telVar: 0,
    alliancePoints: 0,
    archivedAt: null,
    wardrobe: null,
    dailies,
  };
}

const fresh: CharacterDailies = {
  dayKey: "2026-10-03",
  resetAt: resetAtForDayKey("2026-10-03"),
  capturedAt: Date.UTC(2026, 9, 3, 12, 0, 0) / 1000,
  randomNormal: { status: "done" },
  randomVeteran: { status: "available" },
  writs: [
    { craft: "blacksmithing", name: "Blacksmith Writ", status: "done" },
    { craft: "jewelry", name: "Jewelry Crafting Writ", status: "accepted" },
  ],
  pledges: [{ giver: "maj", giverName: "Maj al-Ragath", dungeon: "Fungal Grotto I", status: "done" }],
};

describe("dailies presentation", () => {
  it("keeps in-game statuses before reset", () => {
    const now = Date.UTC(2026, 9, 3, 18, 0, 0) / 1000;
    assert.equal(isDailyScanStale(fresh, now), false);
    const row = presentCharacterDailies(char(fresh), now);
    assert.equal(row.randomNormal.status, "done");
    assert.equal(row.randomVeteran.status, "available");
    assert.equal(row.writs.blacksmithing.status, "done");
    assert.equal(row.writs.jewelry.status, "accepted");
    assert.equal(row.writs.jewelry.label, "ACCEPT");
    assert.equal(row.pledges.maj.status, "done");
    assert.equal(row.pledges.maj.dungeon, "Fungal Grotto I");
    assert.equal(row.stale, false);
  });

  it("does not fake available after reset — unknown with timestamp", () => {
    const after = Date.UTC(2026, 9, 4, 10, 0, 1) / 1000;
    assert.equal(isDailyScanStale(fresh, after), true);
    const row = presentCharacterDailies(char(fresh), after);
    assert.equal(row.stale, true);
    assert.equal(row.randomNormal.status, "unknown");
    assert.equal(row.writs.blacksmithing.status, "unknown");
    assert.equal(row.pledges.maj.status, "unknown");
    assert.match(row.randomNormal.title, /not scanned since reset/);
  });

  it("marks a never-logged character unknown instead of available", () => {
    const now = Date.UTC(2026, 9, 3, 18, 0, 0) / 1000;
    const row = presentCharacterDailies(char(null, null), now);
    assert.equal(row.scanned, false);
    assert.equal(row.randomNormal.status, "unknown");
    assert.match(row.randomNormal.title, /not scanned/);
  });

  it("can keep sample data visible even when the fixture day is old", () => {
    const now = Date.UTC(2026, 9, 4, 12, 0, 0) / 1000;
    const row = presentCharacterDailies(char(fresh), now, { treatAsFresh: true });
    assert.equal(row.stale, false);
    assert.equal(row.randomNormal.status, "done");
  });

  it("does not treat a missing writ as available", () => {
    const now = Date.UTC(2026, 9, 3, 18, 0, 0) / 1000;
    const row = presentCharacterDailies(char(fresh), now);
    assert.equal(row.writs.clothing.status, "unknown");
    assert.equal(row.pledges.urgarlag.status, "unknown");
  });

  it("does not keep a 0.9.19 leftover available writ as a dash", () => {
    const now = Date.UTC(2026, 9, 3, 18, 0, 0) / 1000;
    const leaked: CharacterDailies = {
      ...fresh,
      writs: [{ craft: "blacksmithing", name: "Blacksmith Writ", status: "available" }],
      pledges: [{ giver: "maj", giverName: "Maj al-Ragath", status: "available" }],
    };
    const row = presentCharacterDailies(char(leaked), now);
    assert.equal(row.writs.blacksmithing.status, "unknown");
    assert.equal(row.pledges.maj.status, "unknown");
    assert.equal(row.randomVeteran.status, "available");
  });
});
