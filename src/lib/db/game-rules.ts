/**
 * The game's rules and caps, read from the database: the latest save's
 * rules and every skill line cap the game has reported. It reads the tables
 * directly and has no "server-only" marker, so the goal store (and its
 * tests) can use it; pages import it through game-knowledge.ts.
 */
import { readRules, resetHourFromGame, type GameRules } from "../game/rules";
import { skillLineCap } from "../game/skill-caps";
import type { EsoRegion, ResetClock } from "../game/daily-reset";
import type { SavedRules } from "../snapshot/schema";
import { getDb, getMeta } from "./index";

function savedAccount(): { region?: string | null; rules?: SavedRules | null } | null {
  try {
    return getMeta<{ region?: string | null; rules?: SavedRules | null }>("account");
  } catch {
    return null;
  }
}

/** The game's caps, timers and costs from the latest save; reference values until a save carries them. */
export function gameRules(): GameRules {
  return readRules(savedAccount()?.rules);
}

/** The account's reset clock: the hour the game reported, else the megaserver's reference hour. */
export function resetClock(region?: EsoRegion | null): ResetClock {
  const account = savedAccount();
  const r: EsoRegion = region ?? (account?.region === "NA" ? "NA" : "EU");
  return { region: r, gameHourUtc: resetHourFromGame(account?.rules?.dailyResetAt) };
}

/**
 * Each skill line's last rank as the game reported it, by lower-case name:
 * from the in-game catalog scan, then from characters' saves. Lines the game
 * hasn't reported are absent, so `skillLineCap` falls back to the reference.
 */
export function learnedLineCaps(): Map<string, number> {
  const out = new Map<string, number>();
  const put = (name: unknown, cap: unknown) => {
    if (typeof name !== "string" || typeof cap !== "number" || cap <= 0) return;
    const key = name.trim().toLowerCase();
    if (key && !out.has(key)) out.set(key, cap);
  };
  try {
    const rows = getDb()
      .prepare("SELECT json FROM catalog WHERE domain = 'skillline' AND source = 'ingame'")
      .all() as { json: string }[];
    for (const r of rows) {
      // Only the game's own number: a merged row can carry the seed's maxRank.
      const e = JSON.parse(r.json) as { name?: string; gameMaxRank?: number | null };
      put(e.name, e.gameMaxRank);
    }
  } catch {
    // no catalog yet
  }
  try {
    const rows = getDb().prepare("SELECT json FROM characters").all() as { json: string }[];
    for (const r of rows) {
      const c = JSON.parse(r.json) as { skillLines?: { name?: string; maxRank?: number | null }[] };
      for (const l of c.skillLines ?? []) put(l.name, l.maxRank);
    }
  } catch {
    // no characters yet
  }
  return out;
}

let capsCache: { at: number; caps: Map<string, number> } | null = null;

/** A skill line's last rank: the game's when it has reported it, else the reference (`skillLineCap`). */
export function lineCap(name: string): number | null {
  const now = Date.now();
  if (!capsCache || now - capsCache.at > 5_000) capsCache = { at: now, caps: learnedLineCaps() };
  return skillLineCap(name, capsCache.caps);
}
