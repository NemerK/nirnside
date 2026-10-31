import { getMeta, setMeta } from "../db";

/**
 * Focus — the player picks one character and what they care about right now.
 * Both choices live only in the local DB (like roles and goals): they are
 * player-authored preferences, never game data, and a snapshot re-import can
 * never wipe them.
 */

export interface FocusAreaDef {
  id: string;
  label: string;
  /** One-line hint for the toggle chip. */
  hint: string;
}

export const FOCUS_AREAS: FocusAreaDef[] = [
  { id: "skills", label: "Skills", hint: "Every line, morph and rank" },
  { id: "crafting", label: "Crafting", hint: "Craft levels and trait research" },
  { id: "scribing", label: "Scribing", hint: "Scripts collected vs the catalog" },
  { id: "knowledge", label: "Knowledge", hint: "Motifs, recipes, plans" },
  { id: "champion", label: "Champion Points", hint: "Allocations and slotted stars" },
  { id: "goals", label: "Goals", hint: "Your rank targets for this toon" },
];

export const FOCUS_AREA_IDS = new Set(FOCUS_AREAS.map((a) => a.id));

const KEY = "focus";

interface FocusConfig {
  /** Last character the player focused. */
  char: string | null;
  /** Enabled area ids per character id. Missing = all on. */
  areas: Record<string, string[]>;
}

function normalizeAreas(areas: unknown): string[] {
  const list = Array.isArray(areas) ? areas : [];
  const valid = list.filter((a): a is string => typeof a === "string" && FOCUS_AREA_IDS.has(a));
  // All areas on and all areas off are both stored as-is; the UI needs to
  // distinguish "player turned everything off" from "never chosen".
  return [...new Set(valid)];
}

function readConfig(): FocusConfig {
  try {
    const cfg = getMeta<FocusConfig>(KEY);
    const areas: Record<string, string[]> = {};
    if (cfg?.areas && typeof cfg.areas === "object") {
      for (const [charId, list] of Object.entries(cfg.areas)) {
        if (typeof charId === "string") areas[charId] = normalizeAreas(list);
      }
    }
    return { char: typeof cfg?.char === "string" ? cfg.char : null, areas };
  } catch {
    return { char: null, areas: {} };
  }
}

export function getFocusConfig(): FocusConfig {
  return readConfig();
}

/** Areas the player cares about for this character. Default: every area on. */
export function focusAreasFor(characterId: string): string[] {
  const saved = readConfig().areas[characterId];
  if (saved) return saved;
  return FOCUS_AREAS.map((a) => a.id);
}

export function isAreaOn(characterId: string, areaId: string): boolean {
  return focusAreasFor(characterId).includes(areaId);
}

export function setFocusChar(characterId: string | null): void {
  setMeta(KEY, { ...readConfig(), char: characterId && characterId.trim() ? characterId : null });
}

/** Persist the enabled areas for one character. Unknown ids are dropped. */
export function setFocusAreas(characterId: string, areas: unknown): string[] {
  if (!characterId.trim()) return focusAreasFor(characterId);
  const cfg = readConfig();
  cfg.areas[characterId] = normalizeAreas(areas);
  setMeta(KEY, cfg);
  return cfg.areas[characterId];
}
