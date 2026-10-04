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
  pledges: [{ giver: "maj", giverName: "Maj al-Ragath", dungeon: "Fungal Grotto I", status: "done", hardMode: true, difficulty: "veteran" }],
  worldBosses: [],
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
    assert.equal(row.pledges.maj.hardMode, true);
    assert.match(row.pledges.maj.title, /hard mode/);
    assert.equal(row.stale, false);
  });

  it("marks a finished pledge as normal, veteran, or hard mode", () => {
    const now = Date.UTC(2026, 9, 3, 18, 0, 0) / 1000;
    const normal = presentCharacterDailies(
      char({
        ...fresh,
        pledges: [
          {
            giver: "maj",
            giverName: "Maj al-Ragath",
            dungeon: "Fungal Grotto I",
            status: "done",
            hardMode: false,
            difficulty: "normal",
          },
        ],
      }),
      now,
    );
    assert.equal(normal.pledges.maj.hardMode, false);
    assert.equal(normal.pledges.maj.difficulty, "normal");
    assert.match(normal.pledges.maj.title, /normal/);

    const vet = presentCharacterDailies(
      char({
        ...fresh,
        pledges: [
          {
            giver: "maj",
            giverName: "Maj al-Ragath",
            dungeon: "Fungal Grotto I",
            status: "done",
            hardMode: false,
            difficulty: "veteran",
          },
        ],
      }),
      now,
    );
    assert.equal(vet.pledges.maj.difficulty, "veteran");
    assert.match(vet.pledges.maj.title, /veteran/);

    const unknownMode = presentCharacterDailies(
      char({
        ...fresh,
        pledges: [{ giver: "maj", giverName: "Maj al-Ragath", dungeon: "Fungal Grotto I", status: "done" }],
      }),
      now,
    );
    assert.equal(unknownMode.pledges.maj.status, "done");
    assert.equal(unknownMode.pledges.maj.hardMode, null);
    assert.equal(unknownMode.pledges.maj.difficulty, null);
    assert.match(unknownMode.pledges.maj.title, /mode not captured/);
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

  it("treats a random cooldown as done — no timer", () => {
    const now = Date.UTC(2026, 9, 3, 18, 0, 0) / 1000;
    const row = presentCharacterDailies(
      char({
        ...fresh,
        randomNormal: { status: "cooldown", remainingSeconds: 7 * 3600 + 53 * 60 },
      }),
      now,
    );
    assert.equal(row.randomNormal.status, "done");
    assert.equal(row.randomNormal.label, "✓");
    assert.equal(row.randomNormal.remainingSeconds, undefined);
  });

  it("shows ACCEPT only when this scan found the pledge in the journal", () => {
    const now = Date.UTC(2026, 9, 3, 18, 0, 0) / 1000;
    const accepted = presentCharacterDailies(
      char({
        ...fresh,
        pledges: [
          {
            giver: "maj",
            giverName: "Maj al-Ragath",
            dungeon: "Fungal Grotto I",
            status: "accepted",
            inJournal: true,
          },
        ],
      }),
      now,
    );
    assert.equal(accepted.pledges.maj.status, "accepted");
    assert.equal(accepted.pledges.maj.label, "ACCEPT");

    const leftoverFlag = presentCharacterDailies(
      char({
        ...fresh,
        pledges: [
          { giver: "urgarlag", giverName: "Urgarlag Chief-bane", dungeon: "Icereach", status: "accepted" },
        ],
      }),
      now,
    );
    assert.equal(leftoverFlag.pledges.urgarlag.status, "unknown");
    assert.match(leftoverFlag.pledges.urgarlag.title, /not in journal/);

    const leftoverOtherDay = presentCharacterDailies(
      char({
        ...fresh,
        pledges: [
          {
            giver: "urgarlag",
            giverName: "Urgarlag Chief-bane",
            dungeon: "Icereach",
            status: "accepted",
            inJournal: true,
          },
        ],
      }),
      now,
      { todayPledges: { maj: "Banished Cells II", glirion: "City of Ash II", urgarlag: "Shipwright's Regret" } },
    );
    assert.equal(leftoverOtherDay.pledges.urgarlag.status, "unknown");
    assert.match(leftoverOtherDay.pledges.urgarlag.title, /leftover/);

    const readyHm = presentCharacterDailies(
      char({
        ...fresh,
        pledges: [
          {
            giver: "glirion",
            giverName: "Glirion the Redbeard",
            dungeon: "Icereach",
            status: "ready",
            hardMode: true,
            difficulty: "veteran",
          },
        ],
      }),
      now,
    );
    assert.equal(readyHm.pledges.glirion.status, "ready");
    assert.equal(readyHm.pledges.glirion.hardMode, true);
    assert.equal(readyHm.pledges.glirion.dungeon, "Icereach");
  });

  it("shows a world-boss daily as ACCEPT or done per zone", () => {
    const now = Date.UTC(2026, 9, 3, 18, 0, 0) / 1000;
    const row = presentCharacterDailies(
      char({
        ...fresh,
        worldBosses: [
          { zone: "wrothgar", questId: 5522, name: "Heresy of Ignorance", status: "accepted" },
          { zone: "gold-coast", questId: 5605, name: "Looming Shadows", status: "done" },
        ],
      }),
      now,
    );
    assert.equal(row.worldBosses.wrothgar.status, "accepted");
    assert.equal(row.worldBosses.wrothgar.label, "ACCEPT");
    assert.equal(row.worldBosses["gold-coast"].status, "done");
    assert.equal(row.worldBosses.summerset.status, "unknown");
  });
});
