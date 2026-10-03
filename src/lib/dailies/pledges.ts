/**
 * Undaunted daily pledge givers, by dungeon.
 *
 * Maj = the 16 original pledge dungeons (base-game I/II pairs).
 * Glirion = later base dungeons + DLC through Unhallowed Grave.
 * Urgarlag = Stonethorn (Stone Garden) onward.
 *
 * Matching is English-name only (hub language). The addon uses the same lists
 * so a journal "Pledge: Fungal Grotto I" lands on Maj, not a guess.
 */

export const PLEDGE_GIVERS = ["maj", "glirion", "urgarlag"] as const;
export type PledgeGiver = (typeof PLEDGE_GIVERS)[number];

export const PLEDGE_GIVER_NAMES: Record<PledgeGiver, string> = {
  maj: "Maj al-Ragath",
  glirion: "Glirion the Redbeard",
  urgarlag: "Urgarlag Chief-bane",
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
  "Crypt of Hearts I",
  "Crypt of Hearts II",
  "City of Ash I",
  "City of Ash II",
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
  "Imperial City Prison",
  "White-Gold Tower",
  "White Gold Tower",
  "Ruins of Mazzatun",
  "Cradle of Shadows",
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
];

const URGARLAG = [
  "Stone Garden",
  "Castle Thorn",
  "Black Drake Villa",
  "The Cauldron",
  "Cauldron",
  "Red Petal Bastion",
  "Dread Cellar",
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
