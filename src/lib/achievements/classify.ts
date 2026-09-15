/**
 * Achievement classification — turns raw in-game achievements into the columns
 * of a Pithka-style board.
 *
 * Accuracy rule (see .cursor/rules/nirnside.mdc): completion state is never
 * guessed — it comes straight from the game. This module only decides which
 * *column* an achievement belongs to, and it does so from the achievement's own
 * name + description (both exported verbatim from ESO), not from a hand-written
 * list of expected names. That is exactly what broke the old board: guessed
 * names never matched the game's real names. Here there is nothing to match.
 */

/**
 * Board columns, matching the Pithka Achievement Tracker windows:
 *   - Dungeons/Arenas: Vet · Hard Mode · Speed · No Death · Trifecta · Extras
 *   - Trials:          Vet · Hard Mode (per-boss) · Trifecta · Extras
 * (Which columns a tab actually shows is decided in the board UI.)
 */
export const ACH_COLUMNS = ["Vet", "Hard Mode", "Speed", "No Death", "Trifecta", "Extras"] as const;
export type AchColumn = (typeof ACH_COLUMNS)[number];

/** Top-level content buckets the board groups categories into. */
export const CONTENT_ORDER = ["Trial", "Arena", "Dungeon", "Other"] as const;
export type ContentCategory = (typeof CONTENT_ORDER)[number];

/**
 * Map ESO's raw achievement category name ("Dungeons", "Trials",
 * "Group Arenas", "Solo Arenas", ...) to a coarse content bucket.
 */
export function normalizeCategory(raw: string): ContentCategory {
  const c = raw.toLowerCase();
  if (c.includes("trial")) return "Trial";
  if (c.includes("arena")) return "Arena";
  if (c.includes("dungeon")) return "Dungeon";
  return "Other";
}

const RE_TRIFECTA = /trifecta/;
const RE_HARD_MODE = /hard mode/;
const RE_NO_DEATH =
  /without (?:suffering|any|a single).{0,40}?(?:death|dying|die)|no[- ]death|without dying|no group member (?:dies|dying|died)|without (?:a )?group member (?:death|dying)/;
const RE_SPEED = /in under|in less than|less than .{0,20}?(?:minute|second)|within .{0,20}?(?:minute|second)|speed ?run/;
// A base veteran clear: mentions Veteran and is a completion (not a special
// challenge, which is caught earlier). Covers "Veteran <X>", "<X> Conqueror",
// "…Vanquisher", "complete … on Veteran", etc.
const RE_VET = /\bveteran\b/;
const RE_COMPLETE = /\b(complete[d]?|completion|conquer(?:ed|or)?|vanquish(?:er|ed)?|clear(?:ed)?|defeat(?:ed)? all)\b/;

/**
 * Decide which board column an achievement belongs to, from its name +
 * description (both exported verbatim from ESO). A trifecta requires hard mode
 * AND no deaths AND a time limit — many are literally named "…Trifecta", but
 * the unique-title ones (Immortal Redeemer, Dawnbringer, …) are caught by the
 * combined-requirement check. Anything that isn't a standard challenge or a
 * plain veteran clear lands in Extras — exactly Pithka's "Extras" column.
 */
export function classifyAchievement(a: { name: string; description?: string | null }): AchColumn {
  const hay = `${a.name} ${a.description ?? ""}`.toLowerCase();
  const hard = RE_HARD_MODE.test(hay);
  const noDeath = RE_NO_DEATH.test(hay);
  const speed = RE_SPEED.test(hay);
  if (RE_TRIFECTA.test(hay) || (hard && noDeath && speed)) return "Trifecta";
  if (speed) return "Speed";
  if (noDeath) return "No Death";
  if (hard) return "Hard Mode";
  if (RE_VET.test(hay) && RE_COMPLETE.test(hay)) return "Vet";
  return "Extras";
}
