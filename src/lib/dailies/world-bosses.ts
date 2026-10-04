/**
 * DLC / chapter world-boss daily quests.
 *
 * Quest IDs are the in-game daily repeatables WPamA tracks (one pick per zone
 * per day). Names are filled from GetQuestName at snapshot time — these labels
 * are only zone grouping for the board.
 */

export const WORLD_BOSS_ZONES = [
  { id: "wrothgar", name: "Wrothgar", abbr: "WOR" },
  { id: "vvardenfell", name: "Vvardenfell", abbr: "VV" },
  { id: "gold-coast", name: "Gold Coast", abbr: "GC" },
  { id: "summerset", name: "Summerset", abbr: "SS" },
  { id: "northern-elsweyr", name: "Northern Elsweyr", abbr: "NE" },
  { id: "western-skyrim", name: "Western Skyrim", abbr: "WS" },
  { id: "blackreach", name: "Blackreach", abbr: "BR" },
  { id: "blackwood", name: "Blackwood", abbr: "BW" },
  { id: "high-isle", name: "High Isle", abbr: "HI" },
  { id: "telvanni", name: "Telvanni Peninsula", abbr: "TP" },
  { id: "apocrypha", name: "Apocrypha", abbr: "AP" },
  { id: "gold-road", name: "Gold Road", abbr: "GR" },
  { id: "solstice", name: "Solstice", abbr: "SO" },
] as const;

export type WorldBossZoneId = (typeof WORLD_BOSS_ZONES)[number]["id"];

export const WORLD_BOSS_DAILIES: readonly { zone: WorldBossZoneId; questId: number }[] = [
  { zone: "wrothgar", questId: 5522 },
  { zone: "wrothgar", questId: 5523 },
  { zone: "wrothgar", questId: 5524 },
  { zone: "wrothgar", questId: 5519 },
  { zone: "wrothgar", questId: 5518 },
  { zone: "wrothgar", questId: 5521 },
  { zone: "vvardenfell", questId: 5865 },
  { zone: "vvardenfell", questId: 5904 },
  { zone: "vvardenfell", questId: 5866 },
  { zone: "vvardenfell", questId: 5918 },
  { zone: "vvardenfell", questId: 5916 },
  { zone: "vvardenfell", questId: 5906 },
  { zone: "gold-coast", questId: 5606 },
  { zone: "gold-coast", questId: 5605 },
  { zone: "summerset", questId: 6082 },
  { zone: "summerset", questId: 6087 },
  { zone: "summerset", questId: 6083 },
  { zone: "summerset", questId: 6084 },
  { zone: "summerset", questId: 6086 },
  { zone: "summerset", questId: 6085 },
  { zone: "northern-elsweyr", questId: 6380 },
  { zone: "northern-elsweyr", questId: 6382 },
  { zone: "northern-elsweyr", questId: 6381 },
  { zone: "northern-elsweyr", questId: 6377 },
  { zone: "northern-elsweyr", questId: 6378 },
  { zone: "northern-elsweyr", questId: 6379 },
  { zone: "western-skyrim", questId: 6509 },
  { zone: "western-skyrim", questId: 6517 },
  { zone: "western-skyrim", questId: 6518 },
  { zone: "western-skyrim", questId: 6519 },
  { zone: "blackreach", questId: 6526 },
  { zone: "blackreach", questId: 6527 },
  { zone: "blackwood", questId: 6651 },
  { zone: "blackwood", questId: 6652 },
  { zone: "blackwood", questId: 6650 },
  { zone: "blackwood", questId: 6653 },
  { zone: "blackwood", questId: 6645 },
  { zone: "blackwood", questId: 6649 },
  { zone: "high-isle", questId: 6816 },
  { zone: "high-isle", questId: 6807 },
  { zone: "high-isle", questId: 6821 },
  { zone: "high-isle", questId: 6808 },
  { zone: "high-isle", questId: 6803 },
  { zone: "high-isle", questId: 6822 },
  { zone: "telvanni", questId: 7040 },
  { zone: "telvanni", questId: 7044 },
  { zone: "apocrypha", questId: 7039 },
  { zone: "apocrypha", questId: 7041 },
  { zone: "apocrypha", questId: 7042 },
  { zone: "apocrypha", questId: 7043 },
  { zone: "gold-road", questId: 7109 },
  { zone: "gold-road", questId: 7116 },
  { zone: "gold-road", questId: 7117 },
  { zone: "gold-road", questId: 7118 },
  { zone: "gold-road", questId: 7119 },
  { zone: "gold-road", questId: 7120 },
  { zone: "solstice", questId: 7266 },
  { zone: "solstice", questId: 7264 },
  { zone: "solstice", questId: 7265 },
  { zone: "solstice", questId: 7271 },
  { zone: "solstice", questId: 7272 },
  { zone: "solstice", questId: 7270 },
];

const ZONE_BY_QUEST = new Map(WORLD_BOSS_DAILIES.map((row) => [row.questId, row.zone]));
const ZONE_META = new Map(WORLD_BOSS_ZONES.map((z) => [z.id, z]));

export function worldBossZoneForQuestId(questId: number): WorldBossZoneId | null {
  return ZONE_BY_QUEST.get(questId) ?? null;
}

export function worldBossZoneMeta(id: WorldBossZoneId) {
  return ZONE_META.get(id) ?? null;
}
