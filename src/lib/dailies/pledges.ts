/**
 * Undaunted daily pledge givers and the community rotation.
 *
 * Live NPC split (in-game / UESP, not the old "Maj = all 16 originals" shorthand):
 *   Maj     = 12 original easier I/II dungeons
 *   Glirion = 12 original harder dungeons (incl. City of Ash + Crypt of Hearts)
 *   Urgarlag = every DLC dungeon from Imperial City Prison onward
 *
 * Matching is English-name only (hub language). The addon uses the same lists
 * so a journal "Pledge: Fungal Grotto I" lands on Maj, not a guess.
 *
 * Today's three dungeons are a community calendar (UESP cycle order, verified
 * against ESO-Hub for 2026-10-03). Never presented as an in-game scan.
 */

import { esoDayKey } from "./day";

export const PLEDGE_GIVERS = ["maj", "glirion", "urgarlag"] as const;
export type PledgeGiver = (typeof PLEDGE_GIVERS)[number];

export const PLEDGE_GIVER_NAMES: Record<PledgeGiver, string> = {
  maj: "Maj al-Ragath",
  glirion: "Glirion the Redbeard",
  urgarlag: "Urgarlag Chief-bane",
};

export const PLEDGE_ROTATION_SOURCE = "community" as const;

/** ESO day the community rotation was checked against ESO-Hub + UESP. */
export const PLEDGE_ROTATION_ANCHOR_DAY = "2026-10-03";

export const PLEDGE_ROTATION_ANCHOR: Record<PledgeGiver, string> = {
  maj: "Banished Cells II",
  glirion: "City of Ash II",
  urgarlag: "Shipwright's Regret",
};

const MAJ = [
  "Fungal Grotto I",
  "Fungal Grotto II",
  "Banished Cells I",
  "Banished Cells II",
  "Spindleclutch I",
  "Spindleclutch II",
  "Darkshade Caverns I",
  "Darkshade Caverns II",
  "Elden Hollow I",
  "Elden Hollow II",
  "Wayrest Sewers I",
  "Wayrest Sewers II",
];

const GLIRION = [
  "Arx Corinium",
  "Blackheart Haven",
  "Blessed Crucible",
  "Direfrost Keep",
  "Selene's Web",
  "Tempest Island",
  "Vaults of Madness",
  "Volenfell",
  "Crypt of Hearts I",
  "Crypt of Hearts II",
  "City of Ash I",
  "City of Ash II",
];

const URGARLAG = [
  "Imperial City Prison",
  "White-Gold Tower",
  "White Gold Tower",
  "Cradle of Shadows",
  "Ruins of Mazzatun",
  "Bloodroot Forge",
  "Falkreath Hold",
  "Fang Lair",
  "Scalecaller Peak",
  "Moon Hunter Keep",
  "March of Sacrifices",
  "Frostvault",
  "Depths of Malatar",
  "Lair of Maarselok",
  "Moongrave Fane",
  "Icereach",
  "Unhallowed Grave",
  "Castle Thorn",
  "Stone Garden",
  "Black Drake Villa",
  "The Cauldron",
  "Cauldron",
  "Red Petal Bastion",
  "Dread Cellar",
  "The Dread Cellar",
  "Coral Aerie",
  "Shipwright's Regret",
  "Earthen Root Enclave",
  "Graven Deep",
  "Bal Sunnar",
  "Scrivener's Hall",
  "Oathsworn Pit",
  "Bedlam Veil",
  "Exiled Redoubt",
  "Lep Seclusa",
  "Naj-Caldeesh",
  "Black Gem Foundry",
];

/** Community rotation order (no aliases). Maj/Glirion match Undaunted Daily. */
const MAJ_CYCLE = [
  "Spindleclutch II",
  "Banished Cells I",
  "Fungal Grotto II",
  "Spindleclutch I",
  "Darkshade Caverns II",
  "Elden Hollow I",
  "Wayrest Sewers II",
  "Fungal Grotto I",
  "Banished Cells II",
  "Darkshade Caverns I",
  "Elden Hollow II",
  "Wayrest Sewers I",
];

const GLIRION_CYCLE = [
  "Direfrost Keep",
  "Vaults of Madness",
  "Crypt of Hearts II",
  "City of Ash I",
  "Tempest Island",
  "Blackheart Haven",
  "Arx Corinium",
  "Selene's Web",
  "City of Ash II",
  "Crypt of Hearts I",
  "Volenfell",
  "Blessed Crucible",
];

const URGARLAG_CYCLE = [
  "Imperial City Prison",
  "White-Gold Tower",
  "Cradle of Shadows",
  "Ruins of Mazzatun",
  "Bloodroot Forge",
  "Falkreath Hold",
  "Fang Lair",
  "Scalecaller Peak",
  "March of Sacrifices",
  "Moon Hunter Keep",
  "Depths of Malatar",
  "Frostvault",
  "Lair of Maarselok",
  "Moongrave Fane",
  "Icereach",
  "Unhallowed Grave",
  "Castle Thorn",
  "Stone Garden",
  "Black Drake Villa",
  "The Cauldron",
  "Red Petal Bastion",
  "The Dread Cellar",
  "Coral Aerie",
  "Shipwright's Regret",
  "Earthen Root Enclave",
  "Graven Deep",
  "Bal Sunnar",
  "Scrivener's Hall",
  "Oathsworn Pit",
  "Bedlam Veil",
  "Exiled Redoubt",
  "Lep Seclusa",
  "Naj-Caldeesh",
  "Black Gem Foundry",
];

const CYCLES: Record<PledgeGiver, readonly string[]> = {
  maj: MAJ_CYCLE,
  glirion: GLIRION_CYCLE,
  urgarlag: URGARLAG_CYCLE,
};

export function normalizeDungeonName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^pledge:\s*/i, "")
    .replace(/^the\s+/, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GIVER_BY_DUNGEON = new Map<string, PledgeGiver>();
for (const name of MAJ) GIVER_BY_DUNGEON.set(normalizeDungeonName(name), "maj");
for (const name of GLIRION) GIVER_BY_DUNGEON.set(normalizeDungeonName(name), "glirion");
for (const name of URGARLAG) GIVER_BY_DUNGEON.set(normalizeDungeonName(name), "urgarlag");

export function pledgeGiverForDungeon(name: string | null | undefined): PledgeGiver | null {
  if (!name) return null;
  return GIVER_BY_DUNGEON.get(normalizeDungeonName(name)) ?? null;
}

export function dungeonFromPledgeQuestName(questName: string): string {
  return questName.replace(/^pledge:\s*/i, "").trim();
}

export function sameDungeon(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return normalizeDungeonName(a) === normalizeDungeonName(b);
}

function cycleIndex(cycle: readonly string[], dungeon: string): number {
  const needle = normalizeDungeonName(dungeon);
  return cycle.findIndex((name) => normalizeDungeonName(name) === needle);
}

function dayKeyOffset(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

function dungeonOnCycle(giver: PledgeGiver, dayKey: string): string {
  const cycle = CYCLES[giver];
  const anchorIndex = cycleIndex(cycle, PLEDGE_ROTATION_ANCHOR[giver]);
  const delta = dayKeyOffset(PLEDGE_ROTATION_ANCHOR_DAY, dayKey);
  const index = ((anchorIndex + delta) % cycle.length + cycle.length) % cycle.length;
  return cycle[index] ?? PLEDGE_ROTATION_ANCHOR[giver];
}

/** Today's three pledges from the community calendar. Not an in-game scan. */
export function communityPledgesForDayKey(dayKey: string): Record<PledgeGiver, string> {
  return {
    maj: dungeonOnCycle("maj", dayKey),
    glirion: dungeonOnCycle("glirion", dayKey),
    urgarlag: dungeonOnCycle("urgarlag", dayKey),
  };
}

export function communityPledgesForUnix(unixSeconds: number): Record<PledgeGiver, string> {
  return communityPledgesForDayKey(esoDayKey(unixSeconds));
}
