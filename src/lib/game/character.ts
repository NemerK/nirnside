/**
 * Who a character is: race, alliance and what follows from them.
 *
 * Sources (UESP Online:Races, Online:Character_Creation, Online:Alliances):
 * - Ten playable races, three per alliance; Imperials belong to none and
 *   pick their alliance at character creation.
 * - Race normally decides alliance. The Any Race, Any Alliance bundle lifts
 *   that, so a race outside its home alliance means the account owns it.
 * - Alliance is fixed once the character is created.
 * - Race decides the racial skill line, unlocked at level 5.
 *
 * The scan reports race and alliance in the game's words (GetUnitRace,
 * GetUnitAlliance); these helpers read them.
 */

export const ALLIANCES = ["Aldmeri Dominion", "Daggerfall Covenant", "Ebonheart Pact"] as const;
export type Alliance = (typeof ALLIANCES)[number];

export interface Race {
  id: string;
  /** The game's English name. */
  name: string;
  /** Other names players and the game use ("Altmer"). */
  aliases: string[];
  /** Home alliance; null for Imperials, who choose. */
  alliance: Alliance | null;
}

export const RACES: readonly Race[] = [
  { id: "high-elf", name: "High Elf", aliases: ["Altmer"], alliance: "Aldmeri Dominion" },
  { id: "wood-elf", name: "Wood Elf", aliases: ["Bosmer"], alliance: "Aldmeri Dominion" },
  { id: "khajiit", name: "Khajiit", aliases: [], alliance: "Aldmeri Dominion" },
  { id: "breton", name: "Breton", aliases: [], alliance: "Daggerfall Covenant" },
  { id: "redguard", name: "Redguard", aliases: ["Yokudan"], alliance: "Daggerfall Covenant" },
  { id: "orc", name: "Orc", aliases: ["Orsimer"], alliance: "Daggerfall Covenant" },
  { id: "argonian", name: "Argonian", aliases: ["Saxhleel"], alliance: "Ebonheart Pact" },
  { id: "dark-elf", name: "Dark Elf", aliases: ["Dunmer"], alliance: "Ebonheart Pact" },
  { id: "nord", name: "Nord", aliases: [], alliance: "Ebonheart Pact" },
  { id: "imperial", name: "Imperial", aliases: ["Cyrodiil", "Cyrodilic"], alliance: null },
];

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, " ");

export function findRace(raw: string | null | undefined): Race | null {
  const n = norm(raw).replace(/^the /, "");
  if (!n) return null;
  return RACES.find((r) => norm(r.name) === n || r.id === n || r.aliases.some((a) => norm(a) === n)) ?? null;
}

export function findAlliance(raw: string | null | undefined): Alliance | null {
  const n = norm(raw);
  if (!n) return null;
  if (/aldmeri|dominion/.test(n)) return "Aldmeri Dominion";
  if (/daggerfall|covenant/.test(n)) return "Daggerfall Covenant";
  if (/ebonheart|pact/.test(n)) return "Ebonheart Pact";
  return null;
}

export type AllianceFit =
  /** The race's own alliance. */
  | "home"
  /** An Imperial, who chooses an alliance at creation. */
  | "chosen"
  /** A race outside its home alliance: the account has Any Race, Any Alliance. */
  | "any-race-any-alliance"
  | "unknown";

/** What a race and alliance pairing says about the character and the account. */
export function allianceFit(race: string | null | undefined, alliance: string | null | undefined): AllianceFit {
  const r = findRace(race);
  const a = findAlliance(alliance);
  if (!r || !a) return "unknown";
  if (r.alliance == null) return "chosen";
  return r.alliance === a ? "home" : "any-race-any-alliance";
}

/** Races that can join an alliance without Any Race, Any Alliance. */
export function racesOf(alliance: Alliance): Race[] {
  return RACES.filter((r) => r.alliance === alliance || r.alliance == null);
}

/** The level a character must reach before its racial skill line opens. */
export const RACIAL_LINE_LEVEL = 5;

/** Is this skill line the racial line for that race? Racial lines are named after the race. */
export function isRacialLineFor(lineName: string, race: string | null | undefined): boolean {
  const r = findRace(race);
  if (!r) return false;
  const n = norm(lineName).replace(/ skills?$/, "");
  return n === norm(r.name) || r.aliases.some((a) => norm(a) === n);
}
