import { getMeta, setMeta } from "./db";

/**
 * Toggleable feature modules — the sidebar sections of the app. Each one can be
 * turned off in Setup when the player is done with it (e.g. a finished
 * stickerbook), which hides it from the sidebar and the Home dashboard.
 * Home and Setup are permanent and never listed.
 *
 * This is presentation-level state only, stored locally like the rest of the
 * user's choices. It never touches game data: a hidden module keeps working if
 * you go to its URL directly.
 */

export interface ModuleDef {
  id: string;
  label: string;
  href: string;
  /** One-line "what is this" for the Setup toggle list. */
  description: string;
}

export const TOGGLEABLE_MODULES: ModuleDef[] = [
  {
    id: "focus",
    label: "Focus",
    href: "/focus",
    description: "Pick a character and what you care about right now — skills, crafting, scribing, knowledge, goals.",
  },
  {
    id: "characters",
    label: "Characters",
    href: "/characters",
    description: "The live roster and every character's sheet, gear, bars and skills.",
  },
  {
    id: "inventory",
    label: "Inventory",
    href: "/inventory",
    description: "Every bag on the account — worn, backpack, bank, craft bag — plus the currency table.",
  },
  {
    id: "stickerbook",
    label: "Stickerbook",
    href: "/stickerbook",
    description: "Collected vs missing set pieces, game-like, with seen tracking.",
  },
  {
    id: "knowledge",
    label: "Knowledge",
    href: "/knowledge",
    description: "Per-character research grid, motif chapters and recipe lists.",
  },
  {
    id: "styles",
    label: "Styles",
    href: "/styles",
    description: "Outfit styles unlocked on the account.",
  },
  {
    id: "dailies",
    label: "Dailies",
    href: "/dailies",
    description: "Random dungeons, writs, pledges and zone dailies per day.",
  },
  {
    id: "houses",
    label: "Houses",
    href: "/houses",
    description: "Houses owned on the account.",
  },
  {
    id: "achievements",
    label: "Achievements",
    href: "/achievements",
    description: "Pithka-style trial and dungeon achievement board.",
  },
  {
    id: "encyclopedia",
    label: "Encyclopedia",
    href: "/encyclopedia",
    description: "The live shared catalog: sets, skills, Champion Points, scribing.",
  },
];

export const MODULE_IDS = new Set(TOGGLEABLE_MODULES.map((m) => m.id));

const KEY = "modules";

interface ModulesConfig {
  disabled: string[];
}

/** Module ids currently turned off. Unknown/legacy ids are dropped. */
export function getDisabledModules(): string[] {
  try {
    const cfg = getMeta<ModulesConfig>(KEY);
    return (cfg?.disabled ?? []).filter((id) => MODULE_IDS.has(id));
  } catch {
    return [];
  }
}

export function disabledModuleSet(): Set<string> {
  return new Set(getDisabledModules());
}

export function isModuleEnabled(id: string): boolean {
  return !disabledModuleSet().has(id);
}

/**
 * Persist the off-list. Returns the cleaned list actually saved. Adding a new
 * module later is safe: ids missing from the registry are dropped on read, so
 * old stored data can never hide a module that was added since.
 */
export function setDisabledModules(ids: unknown): string[] {
  const list = Array.isArray(ids) ? ids : [];
  const disabled = [...new Set(list.filter((id): id is string => typeof id === "string" && MODULE_IDS.has(id)))].sort();
  setMeta(KEY, { disabled });
  return disabled;
}
