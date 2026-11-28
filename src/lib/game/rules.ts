import type { SavedRules } from "../snapshot/schema";
import type { FactSource } from "./addons";
import { CP_CAP, CP_PER_CONSTELLATION, SLOTS_PER_CONSTELLATION, findConstellation, type Constellation } from "./champion";
import { COMPANION_MAX_LEVEL } from "./companions";
import { MAX_ABILITY_RANK, SKYSHARDS_PER_POINT } from "./skills";
import { TRAIT_CHANGE_CRYSTALS } from "./transmute";

/**
 * The game's caps, timers and costs, from the game first.
 *
 * Snapshot 0.9.47+ saves the game's own numbers on every save, read where
 * the game's UI reads them (ESOUI API 101051, esoui/esoui 12.1.7):
 *
 * | Rule | Game call |
 * | --- | --- |
 * | Level cap | `GetMaxLevel` |
 * | Champion cap, per constellation | `GetChampionPointsPlayerProgressionCap`, `GetMaxSpendableChampionPointsInAttribute` |
 * | Champion bar slots | `GetRequiredChampionDisciplineIdForSlot` over the champion bar |
 * | Ability ranks | `MAX_RANKS_PER_ABILITY` |
 * | Skyshards per point | `NUM_PARTIAL_SKILL_POINTS_FOR_FULL` |
 * | Companion level cap | `GetNumExperiencePointsInCompanionLevel` |
 * | Rapport range | `GetMinimumRapport`, `GetMaximumRapport` |
 * | Trait change cost | `GetItemRetraitCost` |
 * | Daily and weekly reset | `GetTimedActivityTypeResetTimeS` |
 * | Currency caps | `GetMaxPossibleCurrency` |
 *
 * The reference values (each module's constant) answer only until a save
 * brings the game's, and every answer says which one it is.
 */

export interface GameRules {
  maxLevel: number;
  championCap: number;
  championPerConstellation: number;
  championSlots: Record<Constellation, number>;
  maxAbilityRank: number;
  skyshardsPerPoint: number;
  companionMaxLevel: number;
  /** Skill slots a companion has at each level, from level 1. Empty until the game reports it. */
  companionSlotsByLevel: number[];
  rapport: { min: number | null; max: number | null };
  retraitCost: number;
  /** When the daily activities reset, in unix seconds, as of the save. Null until the game reports it. */
  dailyResetAt: number | null;
  weeklyResetAt: number | null;
  /** The most of a currency that can be held, by wallet key. Only what the game reported. */
  currencyCaps: Record<string, number>;
  /** Where each value came from: the game, or the reference. */
  source: Record<RuleKey, FactSource>;
}

export type RuleKey =
  | "maxLevel"
  | "championCap"
  | "championPerConstellation"
  | "championSlots"
  | "maxAbilityRank"
  | "skyshardsPerPoint"
  | "companionMaxLevel"
  | "retraitCost"
  | "dailyResetAt";

/** Reference values, used only until a save carries the game's. Sources are in each module. */
export const REFERENCE_RULES = {
  maxLevel: 50,
  championCap: CP_CAP,
  championPerConstellation: CP_PER_CONSTELLATION,
  championSlots: { Craft: SLOTS_PER_CONSTELLATION, Warfare: SLOTS_PER_CONSTELLATION, Fitness: SLOTS_PER_CONSTELLATION },
  maxAbilityRank: MAX_ABILITY_RANK,
  skyshardsPerPoint: SKYSHARDS_PER_POINT,
  companionMaxLevel: COMPANION_MAX_LEVEL,
  retraitCost: TRAIT_CHANGE_CRYSTALS,
} as const;

const positive = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

export function readRules(saved: SavedRules | null | undefined): GameRules {
  const s = saved ?? {};
  const source = {} as Record<RuleKey, FactSource>;
  function pick<K extends RuleKey>(key: K, game: number | null | undefined, ref: number): number {
    if (positive(game)) {
      source[key] = "game";
      return game;
    }
    source[key] = "reference";
    return ref;
  }

  const slots: Record<Constellation, number> = { ...REFERENCE_RULES.championSlots };
  const gameSlots = (s.championSlots ?? []).filter((d) => findConstellation(d.name ?? "") && d.slots > 0);
  for (const d of gameSlots) slots[findConstellation(d.name ?? "")!] = d.slots;
  source.championSlots = gameSlots.length === 3 ? "game" : "reference";

  const dailyResetAt = positive(s.dailyResetAt) ? s.dailyResetAt : null;
  source.dailyResetAt = dailyResetAt ? "game" : "reference";

  return {
    maxLevel: pick("maxLevel", s.maxLevel, REFERENCE_RULES.maxLevel),
    championCap: pick("championCap", s.championCap, REFERENCE_RULES.championCap),
    championPerConstellation: pick("championPerConstellation", s.championPerConstellation, REFERENCE_RULES.championPerConstellation),
    championSlots: slots,
    maxAbilityRank: pick("maxAbilityRank", s.maxAbilityRank, REFERENCE_RULES.maxAbilityRank),
    skyshardsPerPoint: pick("skyshardsPerPoint", s.skyshardsPerPoint, REFERENCE_RULES.skyshardsPerPoint),
    companionMaxLevel: pick("companionMaxLevel", s.companionMaxLevel, REFERENCE_RULES.companionMaxLevel),
    companionSlotsByLevel: s.companionSlotsByLevel ?? [],
    rapport: { min: s.rapportMin ?? null, max: s.rapportMax ?? null },
    retraitCost: pick("retraitCost", s.retraitCost, REFERENCE_RULES.retraitCost),
    dailyResetAt,
    weeklyResetAt: positive(s.weeklyResetAt) ? s.weeklyResetAt : null,
    currencyCaps: s.currencyCaps ?? {},
    source,
  };
}

/** The hour (UTC) the game's daily reset falls on, from the reset time it reported. */
export function resetHourFromGame(resetAt: number | null | undefined): number | null {
  if (!positive(resetAt)) return null;
  return Math.floor((resetAt % 86_400) / 3_600);
}
