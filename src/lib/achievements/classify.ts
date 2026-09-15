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

export const ACH_COLUMNS = ["Completion", "Hard Mode", "Speed", "No Death", "Trifecta"] as const;
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

/**
 * Decide which board column an achievement belongs to, from its name +
 * description. A "flawless"/trifecta clear is one that requires hard mode AND
 * no deaths AND a time limit — many are literally named "…Trifecta", but the
 * unique-title ones (Immortal Redeemer, Dawnbringer, …) are caught by the
 * combined-requirement check instead.
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
  return "Completion";
}
