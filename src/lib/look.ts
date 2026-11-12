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
