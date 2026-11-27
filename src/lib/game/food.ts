/**
 * Food and drink. Sources: UESP Online:Provisioning, Online:Recipes.
 *
 * - Only one food or drink buff is active at a time; eating or drinking
 *   another replaces it.
 * - Food raises maximum Health, Magicka or Stamina; drinks raise their
 *   recovery. Special dishes and drinks from events and DLC mix the two.
 * - Recipes come in grades: standard (one stat), difficult (two), complex
 *   (all three), and higher-quality specialities. The Provisioning line's
 *   Recipe Quality passive decides which grades a character can cook.
 *
 * Recipe families by stat, from the game's recipe lists:
 */

export type Resource = "health" | "magicka" | "stamina";
export type BuffKind = "max" | "recovery";

export interface RecipeFamily {
  /** The family the game files recipes under ("Meat Dishes", "Tea"). */
  name: string;
  kind: "food" | "drink";
  boosts: { resource: Resource; kind: BuffKind }[];
}

const max = (...r: Resource[]) => r.map((resource) => ({ resource, kind: "max" as const }));
const rec = (...r: Resource[]) => r.map((resource) => ({ resource, kind: "recovery" as const }));

export const RECIPE_FAMILIES: readonly RecipeFamily[] = [
  { name: "Meat Dishes", kind: "food", boosts: max("health") },
  { name: "Fruit Dishes", kind: "food", boosts: max("magicka") },
  { name: "Vegetable Dishes", kind: "food", boosts: max("stamina") },
  { name: "Savouries", kind: "food", boosts: max("health", "magicka") },
  { name: "Ragout", kind: "food", boosts: max("health", "stamina") },
  { name: "Entremet", kind: "food", boosts: max("magicka", "stamina") },
  { name: "Gourmet", kind: "food", boosts: max("health", "magicka", "stamina") },
  { name: "Alcoholic Drinks", kind: "drink", boosts: rec("health") },
  { name: "Tea", kind: "drink", boosts: rec("magicka") },
  { name: "Tonics", kind: "drink", boosts: rec("stamina") },
  { name: "Liqueurs", kind: "drink", boosts: rec("health", "magicka") },
  { name: "Tinctures", kind: "drink", boosts: rec("health", "stamina") },
  { name: "Cordial Teas", kind: "drink", boosts: rec("magicka", "stamina") },
  { name: "Distillates", kind: "drink", boosts: rec("health", "magicka", "stamina") },
];

export const ACTIVE_FOOD_BUFFS = 1;

/** The family a recipe list belongs to ("Savouries", "Savoury Dishes" …); null for specialities and furnishing. */
export function recipeFamily(listName: string): RecipeFamily | null {
  const n = listName.trim().toLowerCase();
  return (
    RECIPE_FAMILIES.find((f) => n === f.name.toLowerCase()) ??
    RECIPE_FAMILIES.find((f) => n.startsWith(f.name.toLowerCase().replace(/s$/, ""))) ??
    null
  );
}

/** Grade by how many stats a family touches. */
export function recipeGrade(family: RecipeFamily): "standard" | "difficult" | "complex" {
  return family.boosts.length >= 3 ? "complex" : family.boosts.length === 2 ? "difficult" : "standard";
}
