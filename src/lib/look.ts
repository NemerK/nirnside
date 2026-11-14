/**
 * Nirnside has two presentation looks over the same local database:
 *
 * - classic — the original flat sidebar and parchment/gold chrome
 * - atlas — data-grain IA (account / characters / catalog / planning)
 *
 * Look is presentation-only. It never changes imported game data, goals, or
 * module enablement. Persisted in localStorage like theme.
 */

export type Look = "classic" | "atlas";

export const LOOK_STORAGE_KEY = "nirnside-look";

/** Same value as localStorage, so a full page load can paint the right shell. */
export const LOOK_COOKIE = LOOK_STORAGE_KEY;

const LOOK_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** document.cookie assignment. Not HttpOnly: the pre-paint script has to write it. */
export function lookCookieAssignment(look: Look): string {
  return `${LOOK_COOKIE}=${look}; Path=/; Max-Age=${LOOK_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export const LOOKS: { id: Look; label: string; blurb: string }[] = [
  {
    id: "classic",
    label: "Classic",
    blurb: "The original flat sidebar and parchment/gold chrome.",
  },
  {
    id: "atlas",
    label: "Atlas",
    blurb: "Same grouping — account, characters, catalog, planning — in a quieter interface.",
  },
];

export function isLook(value: unknown): value is Look {
  return value === "classic" || value === "atlas";
}

export function normalizeLook(value: unknown): Look {
  return isLook(value) ? value : "classic";
}
