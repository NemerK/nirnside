/**
 * Pithka Achievement Tracker — authoritative dataset.
 *
 * Transcribed from the in-game add-on's own database
 * (PithkaAchievementTracker/data/achievements.lua, v9.17), so the board matches
 * Pithka: the same instances, the same columns, and the same real achievement
 * ids per column. Completion is decided the same way Pithka does it
 * — membership in the account's set of completed achievement ids
 * (IsAchievementComplete). Nothing here is guessed.
 *
 * One addition: Maelstrom Arena's Perfect Run (id 1330, title The Flawless
 * Conqueror). Pithka's MSA row only listed the veteran clear (1305); 1330 is
 * the same id Dungeon Tracker uses for MSA no-death, and that addon's BRP/VSA
 * ids match Pithka's exactly.
 *
 * Column meaning:
 *   vet  — Veteran clear            hm  — Hard Mode (final/full)
 *   sr   — Speed Run                nd  — No Death
 *   cha  — Challenger (dungeons: HM+SR+ND, untimed)
 *   tri  — Trifecta (the flawless run; carries a unique title)
 *   ext  — the instance's "Extra" achievement
 *   phm1/phm2 — trials' per-boss (partial) hard modes
 * A null id means that column does not apply to that instance.
 */

export type PithkaType = "trial" | "triDungeon" | "arena" | "baseDungeon";

export interface PithkaInstance {
  name: string;
  abbv: string;
  type: PithkaType;
  vet?: number | null;
  cha?: number | null;
  hm?: number | null;
  hmName?: string;
  sr?: number | null;
  nd?: number | null;
  phm1?: number | null;
  phm1Name?: string;
  phm2?: number | null;
  phm2Name?: string;
  tri?: number | null;
  triName?: string;
  ext?: number | null;
  extName?: string;
  /** Also shown at the bottom of the Trifecta Dungeons window (like Pithka). */
  alsoInDungeons?: boolean;
}

export const PITHKA_TRIALS: PithkaInstance[] = [
  { name: "Hel Ra Citadel", abbv: "HRC", type: "trial", vet: 1474, hm: 1136, hmName: "Celest. Warrior" },
  { name: "Aetherian Archive", abbv: "AA", type: "trial", vet: 1503, hm: 1137, hmName: "Celest. Mage" },
  { name: "Sanctum Ophidia", abbv: "SO", type: "trial", vet: 1462, hm: 1138, hmName: "Celest. Serpent" },
  { name: "Maw of Lorkhaj", abbv: "MOL", type: "trial", vet: 1368, hm: 1344, hmName: "Rakkhat", ext: 1391, extName: "Dro-m'Athra Destroyer" },
  { name: "Halls of Fabrication", abbv: "HOF", type: "trial", vet: 1810, hm: 1829, hmName: "Assembly Gen.", tri: 1838, triName: "Tick-Tock Tormentor", ext: 1836, extName: "The Dynamo" },
  { name: "Asylum Sanctorium", abbv: "AS", type: "trial", vet: 2077, phm1: 2085, phm1Name: "+Llothis", phm2: 2086, phm2Name: "+Felms", hm: 2079, hmName: "vAS +2", tri: 2087, triName: "Saintly Savior", ext: 2075, extName: "Immortal Redeemer" },
  { name: "Cloudrest", abbv: "CR", type: "trial", vet: 2133, phm1: 2134, phm1Name: "vCR +1", phm2: 2135, phm2Name: "vCR +2", hm: 2136, hmName: "vCR +3", tri: 2139, triName: "Gryphon Heart", ext: 2140, extName: "Welkynar Liberator" },
  { name: "Sunspire", abbv: "SS", type: "trial", vet: 2435, phm1: 2469, phm1Name: "Yolna", phm2: 2470, phm2Name: "Lokke", hm: 2466, hmName: "Nahvi", tri: 2467, triName: "Godslayer", ext: 2468, extName: "Hand of Alkosh" },
  { name: "Kyne's Aegis", abbv: "KA", type: "trial", vet: 2734, phm1: 2736, phm1Name: "Yandir", phm2: 2737, phm2Name: "Vrol", hm: 2739, hmName: "Falgravn", tri: 2740, triName: "Kyne's Wrath", ext: 2746, extName: "Dawnbringer" },
  { name: "Rockgrove", abbv: "RG", type: "trial", vet: 2987, phm1: 3005, phm1Name: "Oaxiltso", phm2: 3006, phm2Name: "Bahsei", hm: 3007, hmName: "Xalvakka", tri: 3003, triName: "Planesbreaker", ext: 3004, extName: "Daedric Bane" },
  { name: "Dreadsail Reef", abbv: "DSR", type: "trial", vet: 3244, phm1: 3250, phm1Name: "Twins", phm2: 3251, phm2Name: "Reef", hm: 3252, hmName: "Taleria", tri: 3248, triName: "Soul of the Squall", ext: 3249, extName: "Swashbuckler Supreme" },
  { name: "Sanity's Edge", abbv: "SE", type: "trial", vet: 3560, phm1: 3566, phm1Name: "Yaseyla", phm2: 3567, phm2Name: "Twelvane", hm: 3568, hmName: "Ansuul", tri: 3564, triName: "Dream Master", ext: 3565, extName: "Mindmender" },
  { name: "Lucent Citadel", abbv: "LC", type: "trial", vet: 4015, phm1: 4021, phm1Name: "Count", phm2: 4022, phm2Name: "Orphic", hm: 4023, hmName: "Arcane Knot", tri: 4019, triName: "Unstoppable", ext: 4020, extName: "Arcane Stabilizer" },
  { name: "Ossein Cage", abbv: "OC", type: "trial", vet: 4268, phm1: 4274, phm1Name: "Shapers", phm2: 4275, phm2Name: "Jynorah", hm: 4276, hmName: "Kazpian", tri: 4272, triName: "Misery's Master", ext: 4273, extName: "Cista Breaker" },
  { name: "Opulent Ordeal", abbv: "OO", type: "trial", vet: 4517, ext: 4485, extName: "Pathwalker" },
];

export const PITHKA_ARENAS: PithkaInstance[] = [
  // 1305 = Maelstrom Arena Conqueror (veteran clear). 1330 = Maelstrom Arena:
  // Perfect Run, which grants the title The Flawless Conqueror. Pithka's own
  // MSA row only listed vet; 1330 is the same id Dungeon Tracker uses for MSA
  // no-death, and that addon's BRP/VSA ids match Pithka's exactly.
  { name: "Maelstrom Arena", abbv: "MSA", type: "arena", vet: 1305, tri: 1330, triName: "Flawless Conqueror" },
  { name: "Dragonstar Arena", abbv: "DSA", type: "arena", vet: 1140 },
  { name: "Blackrose Prison", abbv: "BRP", type: "arena", vet: 2363, hm: 2364, sr: 2366, nd: 2365, tri: 2368, triName: "Unchained", ext: 2372, extName: "A Thrilling Trifecta", alsoInDungeons: true },
  { name: "Vateshran Arena", abbv: "VSA", type: "arena", vet: 2908, tri: 2912, triName: "Spirit Slayer", ext: 2913, extName: "Hero of Undying Song" },
];

export const PITHKA_TRIFECTA_DUNGEONS: PithkaInstance[] = [
  { name: "Fang Lair", abbv: "FL", type: "triDungeon", vet: 1960, cha: 1966, hm: 1965, sr: 1963, nd: 1964, tri: 2102, triName: "Leave No Bone Unbroken", ext: 1967, extName: "Minimal Animosity" },
  { name: "Scalecaller Peak", abbv: "SP", type: "triDungeon", vet: 1976, cha: 1982, hm: 1981, sr: 1979, nd: 1980, tri: 1983, triName: "Mountain God", ext: 1991, extName: "Daedric Deflector" },
  { name: "Moon Hunter Keep", abbv: "MHK", type: "triDungeon", vet: 2153, cha: 2158, hm: 2154, sr: 2155, nd: 2156, tri: 2159, triName: "Pure Lunacy", ext: 2301, extName: "Strangling Cowardice" },
  { name: "March of Sacrifices", abbv: "MOS", type: "triDungeon", vet: 2163, cha: 2167, hm: 2164, sr: 2165, nd: 2166, tri: 2168, triName: "Apex Predator", ext: 2305, extName: "Mist Walker" },
  { name: "Frostvault", abbv: "FV", type: "triDungeon", vet: 2261, cha: 2266, hm: 2262, sr: 2263, nd: 2264, tri: 2267, triName: "Relentless Raider", ext: 2384, extName: "Cold Potato" },
  { name: "Depths of Malatar", abbv: "DOM", type: "triDungeon", vet: 2271, cha: 2275, hm: 2272, sr: 2273, nd: 2274, tri: 2276, triName: "Depths Defier", ext: 2395, extName: "Lackluster" },
  { name: "Lair of Maarselok", abbv: "LOM", type: "triDungeon", vet: 2426, cha: 2430, hm: 2427, sr: 2428, nd: 2429, tri: 2431, triName: "Nature's Wrath", ext: 2581, extName: "Shagrath's Shield" },
  { name: "Moongrave Fane", abbv: "MF", type: "triDungeon", vet: 2416, cha: 2421, hm: 2417, sr: 2418, nd: 2419, tri: 2422, triName: "Defanged the Devourer", ext: 2575, extName: "Drop the Block" },
  { name: "Icereach", abbv: "IR", type: "triDungeon", vet: 2540, cha: 2545, hm: 2541, sr: 2542, nd: 2543, tri: 2546, triName: "Storm Foe", ext: 2677, extName: "Prodigous Pacification" },
  { name: "Unhallowed Grave", abbv: "UG", type: "triDungeon", vet: 2550, cha: 2554, hm: 2551, sr: 2552, nd: 2553, tri: 2555, triName: "Bonecaller's Bane", ext: 2679, extName: "Relentless Dogcatcher" },
  { name: "Stone Garden", abbv: "SG", type: "triDungeon", vet: 2695, cha: 2700, hm: 2755, sr: 2697, nd: 2698, tri: 2701, triName: "True Genius", ext: 2824, extName: "Old Fashioned" },
  { name: "Castle Thorn", abbv: "CT", type: "triDungeon", vet: 2705, cha: 2709, hm: 2706, sr: 2707, nd: 2708, tri: 2710, triName: "Bane of Thorns", ext: 2828, extName: "Guardian Preserved" },
  { name: "Black Drake Villa", abbv: "BDV", type: "triDungeon", vet: 2832, cha: 2837, hm: 2833, sr: 2834, nd: 2835, tri: 2838, triName: "Ardent Bibliophile", ext: 2883, extName: "Salley-oop" },
  { name: "The Cauldron", abbv: "TC", type: "triDungeon", vet: 2842, cha: 2846, hm: 2843, sr: 2844, nd: 2845, tri: 2847, triName: "Subterranean Smasher", ext: 2886, extName: "Can't Catch Me" },
  { name: "Red Petal Bastion", abbv: "RPB", type: "triDungeon", vet: 3017, cha: 3022, hm: 3018, sr: 3019, nd: 3020, tri: 3023, triName: "of the Silver Rose", ext: 3035, extName: "Terror Billy" },
  { name: "Dread Cellar", abbv: "DC", type: "triDungeon", vet: 3027, cha: 3031, hm: 3028, sr: 3029, nd: 3030, tri: 3032, triName: "the Dreaded", ext: 3042, extName: "Settling Scores" },
  { name: "Coral Aerie", abbv: "CA", type: "triDungeon", vet: 3105, cha: 3110, hm: 3153, sr: 3107, nd: 3108, tri: 3111, triName: "Coral Caretaker", ext: 3226, extName: "Tentacless Triumph" },
  { name: "Shipwright's Regret", abbv: "SR", type: "triDungeon", vet: 3115, cha: 3119, hm: 3154, sr: 3117, nd: 3118, tri: 3120, triName: "Privateer", ext: 3224, extName: "Sans Spirit Support" },
  { name: "Earthen Root Enclave", abbv: "ERE", type: "triDungeon", vet: 3376, cha: 3380, hm: 3377, sr: 3378, nd: 3379, tri: 3381, triName: "Invaders' Bane", ext: 3391, extName: "Scourge of Archdruid" },
  { name: "Graven Deep", abbv: "GD", type: "triDungeon", vet: 3395, cha: 3399, hm: 3396, sr: 3397, nd: 3398, tri: 3400, triName: "Fist of Tava", ext: 3410, extName: "Pressure in the Deep" },
  { name: "Bal Sunnar", abbv: "BS", type: "triDungeon", vet: 3469, cha: 3473, hm: 3470, sr: 3471, nd: 3472, tri: 3474, triName: "Temporal Tempest", ext: 3484, extName: "No Time to Waste" },
  { name: "Scrivener's Hall", abbv: "SH", type: "triDungeon", vet: 3530, cha: 3534, hm: 3531, sr: 3532, nd: 3533, tri: 3535, triName: "Curator's Champion", ext: 3538, extName: "Harsh Edit" },
  { name: "Oathsworn Pit", abbv: "OP", type: "triDungeon", vet: 3811, cha: 3815, hm: 3812, sr: 3813, nd: 3814, tri: 3816, triName: "Oathsworn", ext: 3826, extName: "Dogged Avenger" },
  { name: "Bedlam Veil", abbv: "BV", type: "triDungeon", vet: 3852, cha: 3856, hm: 3853, sr: 3854, nd: 3855, tri: 3857, triName: "Bedlam's Disciple", ext: 3867, extName: "Martial Gift" },
  { name: "Exiled Redoubt", abbv: "ER", type: "triDungeon", vet: 4110, cha: 4114, hm: 4111, sr: 4112, nd: 4113, tri: 4115, triName: "Revenge Breaker", ext: 4120, extName: "Exposed to the Elements" },
  { name: "Lep Seclusa", abbv: "LS", type: "triDungeon", vet: 4129, cha: 4133, hm: 4130, sr: 4131, nd: 4132, tri: 4134, triName: "Sic Semper", ext: 4139, extName: "Fight the Darkness" },
  { name: "Naj-Caldeesh", abbv: "NC", type: "triDungeon", vet: 4312, cha: 4316, hm: 4313, sr: 4314, nd: 4315, tri: 4317, triName: "Key to the Stone", ext: 4327, extName: "No Time To Explore" },
  { name: "Black Gem Foundry", abbv: "BGF", type: "triDungeon", vet: 4335, cha: 4339, hm: 4336, sr: 4337, nd: 4338, tri: 4340, triName: "Cut Above The Rest", ext: 4350, extName: "Entry-Level Position" },
];

export const PITHKA_BASE_DUNGEONS: PithkaInstance[] = [
  { name: "Fungal Grotto I", abbv: "FG1", type: "baseDungeon", vet: 1556, hm: 1561, sr: 1559, nd: 1560 },
  { name: "Fungal Grotto II", abbv: "FG2", type: "baseDungeon", vet: 343, hm: 342, sr: 340, nd: 1563 },
  { name: "Banished Cells I", abbv: "BC1", type: "baseDungeon", vet: 1549, hm: 1554, sr: 1552, nd: 1553 },
  { name: "Banished Cells II", abbv: "BC2", type: "baseDungeon", vet: 545, hm: 451, sr: 449, nd: 1564 },
  { name: "Elden Hollow I", abbv: "EH1", type: "baseDungeon", vet: 1573, hm: 1578, sr: 1576, nd: 1577 },
  { name: "Elden Hollow II", abbv: "EH2", type: "baseDungeon", vet: 459, hm: 463, sr: 461, nd: 1580 },
  { name: "City of Ash I", abbv: "COA1", type: "baseDungeon", vet: 1597, hm: 1602, sr: 1600, nd: 1601 },
  { name: "City of Ash II", abbv: "COA2", type: "baseDungeon", vet: 878, hm: 1114, sr: 1108, nd: 1107 },
  { name: "Crypt of Hearts I", abbv: "COH1", type: "baseDungeon", vet: 1610, hm: 1615, sr: 1613, nd: 1614 },
  { name: "Crypt of Hearts II", abbv: "COH2", type: "baseDungeon", vet: 876, hm: 1084, sr: 941, nd: 942 },
  { name: "Darkshade Caverns I", abbv: "DC1", type: "baseDungeon", vet: 1581, hm: 1586, sr: 1584, nd: 1585 },
  { name: "Darkshade Caverns II", abbv: "DC2", type: "baseDungeon", vet: 464, hm: 467, sr: 465, nd: 1588 },
  { name: "Spindleclutch I", abbv: "SC1", type: "baseDungeon", vet: 1565, hm: 1570, sr: 1568, nd: 1569 },
  { name: "Spindleclutch II", abbv: "SC2", type: "baseDungeon", vet: 421, hm: 448, sr: 446, nd: 1572 },
  { name: "Wayrest Sewers I", abbv: "WS1", type: "baseDungeon", vet: 1589, hm: 1594, sr: 1592, nd: 1593 },
  { name: "Wayrest Sewers II", abbv: "WS2", type: "baseDungeon", vet: 678, hm: 681, sr: 679, nd: 1596 },
  { name: "Arx Corinium", abbv: "AC", type: "baseDungeon", vet: 1604, hm: 1609, sr: 1607, nd: 1608 },
  { name: "Blackheart Haven", abbv: "BH", type: "baseDungeon", vet: 1647, hm: 1652, sr: 1650, nd: 1651 },
  { name: "Blessed Crucible", abbv: "BC", type: "baseDungeon", vet: 1641, hm: 1646, sr: 1644, nd: 1645 },
  { name: "Direfrost Keep", abbv: "DK", type: "baseDungeon", vet: 1623, hm: 1628, sr: 1626, nd: 1627 },
  { name: "Selene's Web", abbv: "SW", type: "baseDungeon", vet: 1635, hm: 1640, sr: 1638, nd: 1639 },
  { name: "Tempest Island", abbv: "TI", type: "baseDungeon", vet: 1617, hm: 1622, sr: 1620, nd: 1621 },
  { name: "Vaults of Madness", abbv: "VOM", type: "baseDungeon", vet: 1653, hm: 1658, sr: 1656, nd: 1657 },
  { name: "Volenfell", abbv: "VOL", type: "baseDungeon", vet: 1629, hm: 1634, sr: 1632, nd: 1633 },
  { name: "White Gold Tower", abbv: "WGT", type: "baseDungeon", vet: 1120, hm: 1279, sr: 1275, nd: 1276 },
  { name: "Imperial City Prison", abbv: "ICP", type: "baseDungeon", vet: 880, hm: 1303, sr: 1128, nd: 1129 },
  { name: "Ruins of Mazzatun", abbv: "ROM", type: "baseDungeon", vet: 1505, hm: 1506, sr: 1507, nd: 1508 },
  { name: "Cradle of Shadows", abbv: "COS", type: "baseDungeon", vet: 1523, hm: 1524, sr: 1525, nd: 1526 },
  { name: "Falkreath Hold", abbv: "FH", type: "baseDungeon", vet: 1699, hm: 1704, sr: 1702, nd: 1703 },
  { name: "Bloodroot Forge", abbv: "BF", type: "baseDungeon", vet: 1691, hm: 1696, sr: 1694, nd: 1695 },
];

/** Trifecta Dungeons window also lists Blackrose Prison at the bottom. */
export const PITHKA_DUNGEON_VIEW: PithkaInstance[] = [
  ...PITHKA_TRIFECTA_DUNGEONS,
  ...PITHKA_ARENAS.filter((a) => a.alsoInDungeons),
];

export type PithkaTab = "Trials" | "Trifecta Dungeons" | "Arenas" | "Base Dungeons";

export const PITHKA_TABS: { id: PithkaTab; rows: PithkaInstance[] }[] = [
  { id: "Trials", rows: PITHKA_TRIALS },
  { id: "Trifecta Dungeons", rows: PITHKA_DUNGEON_VIEW },
  { id: "Arenas", rows: PITHKA_ARENAS },
  { id: "Base Dungeons", rows: PITHKA_BASE_DUNGEONS },
];

/** Every achievement id Pithka tracks, for computing overall done/total. */
export function allTrackedIds(rows: PithkaInstance[]): number[] {
  const ids: number[] = [];
  for (const r of rows) {
    for (const v of [r.vet, r.cha, r.hm, r.sr, r.nd, r.phm1, r.phm2, r.tri, r.ext]) {
      if (typeof v === "number") ids.push(v);
    }
  }
  return ids;
}

/** Unique ids across every Pithka window, sorted. */
export function allPithkaAchievementIds(): number[] {
  return [...new Set(PITHKA_TABS.flatMap((t) => allTrackedIds(t.rows)))].sort((a, b) => a - b);
}

/**
 * Achievements never un-complete. A later snapshot can miss ids (a toon whose
 * journal doesn't list every category, or an incomplete sweep), so we union
 * what we already knew with what the new snapshot reports.
 */
export function unionCompletedAchievementIds(
  previous: readonly number[] | undefined,
  incoming: readonly number[] | undefined,
): number[] {
  const set = new Set<number>();
  for (const id of previous ?? []) {
    if (Number.isInteger(id) && id >= 0) set.add(id);
  }
  for (const id of incoming ?? []) {
    if (Number.isInteger(id) && id >= 0) set.add(id);
  }
  return [...set].sort((a, b) => a - b);
}
