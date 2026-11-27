/**
 * Addons, and where every fact Nirnside holds comes from.
 *
 * What an ESO addon is (ESOUI wiki and forums, ZOS API notes):
 * - A folder of Lua and XML the ESO client loads at login, described by a
 *   .txt manifest (## Title, ## APIVersion, ## AddOnVersion,
 *   ## SavedVariables, ## DependsOn / ## OptionalDependsOn).
 * - It runs inside the game client and sees only what ZeniMax's public API
 *   exposes. It can't act on the server beyond that API, and it can't pass
 *   data to other players through files.
 * - Its only storage is SavedVariables: tables kept in game memory and
 *   written to disk at a /reloadui, a zone change with a loading screen, a
 *   logout, or quitting. A crash or Alt+F4 can skip the write; edits made to
 *   the file while the game runs are overwritten.
 * - A dependency (## DependsOn / ## OptionalDependsOn) makes one addon load
 *   after another, so it can read the other's tables in game.
 *
 * What that means for Nirnside: everything it knows arrives through
 * SavedVariables files, so every fact is "as of the last save", and facts
 * written by another addon are that addon's record, not the game's.
 */

export type FactSource =
  /** Read from the game's API by Nirnside's own addon. */
  | "game"
  /** Read from another addon's saved data (a player's plans, settings). */
  | "addon"
  /** The in-game catalog scan (/nirncatalog). */
  | "catalog"
  /** Documentation or shipped reference data. */
  | "reference"
  /** Typed by the player in Nirnside (targets, roles, notes). */
  | "player";

/** Higher is more authoritative for describing the game as it is. */
export const SOURCE_TRUST: Record<FactSource, number> = {
  game: 5,
  catalog: 4,
  addon: 3,
  player: 2,
  reference: 1,
};

export interface KnownAddon {
  /** Folder / manifest name. */
  id: string;
  title: string;
  author: "nirnside" | "third-party";
  /** The SavedVariables global it writes. */
  savedVariables: string;
  /** What its data describes. */
  describes: string;
  /** Whether its data is the game's live state, or the player's intent. */
  kind: "state" | "catalog" | "plans";
  /** How Nirnside gets at it. */
  route: string;
  /** Optional: missing it only removes what it adds. */
  optional: boolean;
}

export const KNOWN_ADDONS: readonly KnownAddon[] = [
  {
    id: "NirnsideSnapshot",
    title: "Nirnside Snapshot",
    author: "nirnside",
    savedVariables: "NirnsideData",
    describes:
      "The account and every character as the game reports them: gear, skills, Champion Points, research, motifs, recipes, collections, currencies, dailies.",
    kind: "state",
    route: "Written at logout; Nirnside reads the SavedVariables file.",
    optional: false,
  },
  {
    id: "NirnsideCatalog",
    title: "Nirnside Catalog",
    author: "nirnside",
    savedVariables: "NirnsideCatalog",
    describes: "The game's catalog: sets, skill lines and abilities, Champion Point stars, scribing, achievements.",
    kind: "catalog",
    route: "Runs only on /nirncatalog; Nirnside imports the file it writes.",
    optional: true,
  },
  {
    id: "WizardsWardrobe",
    title: "Wizard's Wardrobe",
    author: "third-party",
    savedVariables: "WizardsWardrobeSV",
    describes:
      "Setups a player saved for raids, per zone, page and boss: gear, both skill bars, slotted Champion Points and food. It swaps them in when a boss appears.",
    kind: "plans",
    route:
      "Nirnside Snapshot lists it as ## OptionalDependsOn, so it loads after Wizard's Wardrobe and reads its tables in game, following the page the player has open (this character, another character, or account-wide storage).",
    optional: true,
  },
];

export function knownAddon(id: string): KnownAddon | undefined {
  return KNOWN_ADDONS.find((a) => a.id.toLowerCase() === id.trim().toLowerCase());
}

/** When the data was saved, and how much to trust it as "now". */
export interface Freshness {
  savedAt: number | null;
  ageSeconds: number | null;
  /** Whether a daily reset has passed since (dailies, research timers, etc. moved on). */
  pastReset: boolean;
}

export function freshness(savedAt: number | null | undefined, now: number, nextResetAfterSave?: number | null): Freshness {
  if (!savedAt) return { savedAt: null, ageSeconds: null, pastReset: false };
  return {
    savedAt,
    ageSeconds: Math.max(0, now - savedAt),
    pastReset: nextResetAfterSave != null ? now >= nextResetAfterSave : false,
  };
}

/**
 * Research timers in a save count down in the game, not in the file: what
 * is left now is what was left at the save, minus the time since.
 */
export function remainingNow(remainingAtSave: number | null | undefined, savedAt: number | null | undefined, now: number): number | null {
  if (!savedAt) return null;
  return countDown(remainingAtSave, now - savedAt);
}

/** A timer saved with `remaining` seconds left, `elapsed` seconds later. */
export function countDown(remaining: number | null | undefined, elapsed: number): number | null {
  return remaining == null ? null : Math.max(0, remaining - Math.max(0, elapsed));
}
