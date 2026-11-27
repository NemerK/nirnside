import type { PieceKind, TraitFamily } from "./equipment";
import { traitFamilyOf } from "./equipment";

/**
 * Item traits in the order of the game's research grid (and UESP's
 * Online:Traits tables). Shields take armor traits. Ornate and Intricate
 * appear on drops but can't be researched or crafted.
 */
export const WEAPON_TRAITS = ["Powered", "Charged", "Precise", "Infused", "Defending", "Training", "Sharpened", "Decisive", "Nirnhoned"] as const;
export const ARMOR_TRAITS = ["Sturdy", "Impenetrable", "Reinforced", "Well-fitted", "Training", "Infused", "Invigorating", "Divines", "Nirnhoned"] as const;
export const JEWELRY_TRAITS = ["Healthy", "Arcane", "Robust", "Bloodthirsty", "Harmony", "Infused", "Triune", "Protective", "Swift"] as const;

export const TRAITS: Record<TraitFamily, readonly string[]> = {
  weapon: WEAPON_TRAITS,
  armor: ARMOR_TRAITS,
  jewelry: JEWELRY_TRAITS,
};

export const UNRESEARCHABLE_TRAITS = ["Ornate", "Intricate"] as const;


/** The traits a piece can be crafted with. */
export function traitsFor(p: PieceKind): readonly string[] {
  return TRAITS[traitFamilyOf(p)];
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[‐-―]/g, "-");

/**
 * The game's trait name, from what a scan wrote: "Well-fitted", "Armor
 * Sturdy" (the game's long form), "Jewelry Arcane"; null when unknown.
 */
export function canonicalTrait(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = norm(raw).replace(/^(armor|weapon|jewelry)\s+/, "");
  for (const list of Object.values(TRAITS)) {
    const hit = list.find((t) => norm(t) === n);
    if (hit) return hit;
  }
  const extra = UNRESEARCHABLE_TRAITS.find((t) => norm(t) === n);
  return extra ?? null;
}
