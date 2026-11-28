import type { CatalogRecipe } from "../catalog/schema";
import type { RecipeList } from "../snapshot/schema";
import { TRADESKILL_NAMES, isTradeskill, type Tradeskill } from "./tradeskills";

/**
 * Recipes and furnishing plans: what each one makes, where it's crafted,
 * what it needs, and whether a character knows it and can craft it.
 *
 * Every fact is the game's: the catalog scan (Catalog 0.2.11+) reads each
 * recipe the way the crafting station and tooltip do, and a character's save
 * (Snapshot 0.9.48+) carries which recipes they know (linked by the result
 * item's id) and their level in each craft's level passive. The game's
 * station refuses a recipe whose passive level or Recipe Quality the
 * character lacks (provisioner.lua), so "can craft" means known and every
 * requirement met. The game doesn't say where a plan drops.
 */

export interface RecipeCharacter {
  recipeLists?: readonly RecipeList[] | null;
  craftLevels?: Readonly<Record<string, number>> | null;
}

export interface RequirementReading {
  /** "Metalworking 3", "Recipe Quality 2": the game's wording, without "Requires". */
  label: string;
  craft: Tradeskill | null;
  level: number;
  /** Whether the character has it; null when their levels weren't saved. */
  met: boolean | null;
}

export interface RecipeReading {
  id: string;
  name: string;
  kind: CatalogRecipe["kind"];
  craft: Tradeskill | null;
  craftName: string | null;
  list: string | null;
  requirements: RequirementReading[];
  /** Null when there's no character, or the save didn't list this recipe. */
  known: boolean | null;
  /** Known and every requirement met; null when that can't be told. */
  canCraft: boolean | null;
}

/** The character's recipes by result item id (newer saves) and by name (any save). */
export function knownRecipes(c: RecipeCharacter): { byId: Map<number, boolean>; byName: Map<string, boolean> } {
  const byId = new Map<number, boolean>();
  const byName = new Map<string, boolean>();
  for (const list of c.recipeLists ?? []) {
    for (const r of list.recipes) {
      if (r.resultItemId) byId.set(r.resultItemId, r.known);
      byName.set(r.name.trim().toLowerCase(), r.known);
    }
  }
  return { byId, byName };
}

export function readRecipe(
  entry: CatalogRecipe,
  character?: RecipeCharacter | null,
  known?: ReturnType<typeof knownRecipes>,
): RecipeReading {
  const craft = isTradeskill(entry.craft) ? entry.craft : null;
  const levels = character?.craftLevels ?? null;
  const requirements: RequirementReading[] = entry.requires.map((r) => {
    const rc = isTradeskill(r.craft) ? r.craft : null;
    const have = rc && levels ? levels[rc] : undefined;
    return {
      label: `${r.passive || (rc ? TRADESKILL_NAMES[rc] : "Tradeskill")} ${r.level}`,
      craft: rc,
      level: r.level,
      met: typeof have === "number" ? have >= r.level : null,
    };
  });
  if (entry.qualityReq) {
    const have = levels?.recipeQuality;
    requirements.push({
      label: `Recipe Quality ${entry.qualityReq}`,
      craft: "provisioning",
      level: entry.qualityReq,
      met: typeof have === "number" ? have >= entry.qualityReq : null,
    });
  }

  let isKnown: boolean | null = null;
  if (character) {
    const k = known ?? knownRecipes(character);
    const resultId = entry.result?.itemId ?? null;
    isKnown = (resultId != null ? k.byId.get(resultId) : undefined) ?? k.byName.get(entry.name.trim().toLowerCase()) ?? null;
  }
  const allMet = requirements.every((r) => r.met === true);
  const anyUnknown = requirements.some((r) => r.met === null);
  const canCraft = isKnown === null ? null : !isKnown ? false : allMet ? true : anyUnknown ? null : false;

  return {
    id: entry.id,
    name: entry.result?.name || entry.name,
    kind: entry.kind,
    craft,
    craftName: entry.craftName ?? (craft ? TRADESKILL_NAMES[craft] : null),
    list: entry.list,
    requirements,
    known: isKnown,
    canCraft,
  };
}
