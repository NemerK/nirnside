import { WRIT_CRAFTS, WRIT_LABELS } from "../dailies/present";
import { PLEDGE_GIVER_NAMES } from "../dailies/pledges";
import { WORLD_BOSS_ZONES } from "../dailies/world-bosses";

/**
 * Which dailies you want to see on a character's "Today": an account-wide
 * default, and an override for any character that plays differently.
 */

export interface DailyTrackable {
  key: string;
  label: string;
  group: "Dungeons" | "Crafting writs" | "Undaunted pledges" | "World bosses";
}

export const DAILY_TRACKABLES: DailyTrackable[] = [
  { key: "random-normal", label: "Random normal dungeon", group: "Dungeons" },
  { key: "random-veteran", label: "Random veteran dungeon", group: "Dungeons" },
  ...WRIT_CRAFTS.map((w) => ({ key: `writ-${w}`, label: `${WRIT_LABELS[w]} writ`, group: "Crafting writs" as const })),
  ...(Object.keys(PLEDGE_GIVER_NAMES) as (keyof typeof PLEDGE_GIVER_NAMES)[]).map((g) => ({
    key: `pledge-${g}`,
    label: PLEDGE_GIVER_NAMES[g],
    group: "Undaunted pledges" as const,
  })),
  ...WORLD_BOSS_ZONES.map((z) => ({ key: `boss-${z.id}`, label: z.name, group: "World bosses" as const })),
];

const KEYS = new Set(DAILY_TRACKABLES.map((d) => d.key));

/** Until you choose: dungeons, writs and pledges. World bosses are one click away. */
export const DEFAULT_TRACKED = DAILY_TRACKABLES.filter((d) => d.group !== "World bosses").map((d) => d.key);

export interface DailyTracking {
  /** Null: the default list (DEFAULT_TRACKED). */
  account: string[] | null;
  /** Characters that track something other than the account default. */
  characters: Record<string, string[]>;
}

function cleanKeys(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  return [...new Set(v.filter((k): k is string => typeof k === "string" && KEYS.has(k)))];
}

export function normalizeTracking(raw: unknown): DailyTracking {
  const out: DailyTracking = { account: null, characters: {} };
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  out.account = cleanKeys(r.account);
  if (r.characters && typeof r.characters === "object") {
    for (const [id, keys] of Object.entries(r.characters as Record<string, unknown>)) {
      const clean = cleanKeys(keys);
      if (clean && id.length <= 200) out.characters[id] = clean;
    }
  }
  return out;
}

/** What a character tracks, and whether that's their own choice. */
export function trackedFor(t: DailyTracking, characterId: string): { keys: string[]; own: boolean } {
  const own = t.characters[characterId];
  if (own) return { keys: own, own: true };
  return { keys: t.account ?? DEFAULT_TRACKED, own: false };
}

/** Apply a change: set the account default, or one character's own list (null clears it). */
export function changeTracking(
  t: DailyTracking,
  change: { scope: "account"; keys: string[] | null } | { scope: "character"; characterId: string; keys: string[] | null },
): DailyTracking {
  if (change.scope === "account") return normalizeTracking({ ...t, account: change.keys });
  const characters = { ...t.characters };
  if (change.keys == null) delete characters[change.characterId];
  else characters[change.characterId] = change.keys;
  return normalizeTracking({ ...t, characters });
}
