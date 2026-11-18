import type { SlotKind } from "./slots";

/**
 * Trait and armor-weight choices for a build.
 *
 * The lists are the live research grid: nine armor traits (shields included),
 * nine weapon traits, and nine jewelry traits. Jewelry cannot be Divines.
 * A shield uses armor traits. Weight is Light, Medium, or Heavy, and only
 * body armor has one. Weapons and jewelry do not.
 */
export type ArmorWeight = "light" | "medium" | "heavy";

export const ARMOR_WEIGHTS: readonly { id: ArmorWeight; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "medium", label: "Medium" },
  { id: "heavy", label: "Heavy" },
];

export const ARMOR_TRAITS = [
  "Divines",
  "Invigorating",
  "Infused",
  "Reinforced",
  "Sturdy",
  "Well-fitted",
  "Training",
  "Impenetrable",
  "Nirnhoned",
] as const;

export const WEAPON_TRAITS = [
  "Infused",
  "Precise",
  "Nirnhoned",
  "Sharpened",
  "Charged",
  "Powered",
  "Defending",
  "Decisive",
  "Training",
] as const;

export const JEWELRY_TRAITS = [
  "Bloodthirsty",
  "Infused",
  "Arcane",
  "Healthy",
  "Robust",
  "Triune",
  "Harmony",
  "Protective",
  "Swift",
] as const;

export interface TraitPlan {
  weight: ArmorWeight;
  armorTrait: string;
  jewelryTrait: string;
  frontTrait: string;
  backTrait: string;
}

export function defaultTraitPlan(): TraitPlan {
  return {
    weight: "medium",
    armorTrait: "Divines",
    jewelryTrait: "Bloodthirsty",
    frontTrait: "Infused",
    backTrait: "Infused",
  };
}

export function isArmorWeight(value: unknown): value is ArmorWeight {
  return value === "light" || value === "medium" || value === "heavy";
}

export function weightLabel(weight: ArmorWeight): string {
  return ARMOR_WEIGHTS.find((row) => row.id === weight)?.label ?? weight;
}

const BODY_ARMOR = ["head", "shoulders", "chest", "hands", "waist", "legs", "feet"] as const;

type BodySlot = (typeof BODY_ARMOR)[number];

export function isBodyArmor(kind: SlotKind): kind is BodySlot {
  return (BODY_ARMOR as readonly SlotKind[]).includes(kind);
}

export type TraitGroup = "armor" | "weapon" | "jewelry";

export function traitGroup(kind: SlotKind): TraitGroup | null {
  if (kind === "neck" || kind === "ring") return "jewelry";
  if (kind === "oneHand" || kind === "twoHand") return "weapon";
  if (kind === "shield" || isBodyArmor(kind)) return "armor";
  return null;
}

export function traitsFor(kind: SlotKind): readonly string[] {
  const group = traitGroup(kind);
  if (group === "jewelry") return JEWELRY_TRAITS;
  if (group === "weapon") return WEAPON_TRAITS;
  if (group === "armor") return ARMOR_TRAITS;
  return [];
}

/** The trait this slot is aiming for. A mythic has none. */
export function traitFor(plan: TraitPlan, slotId: string | null, kind: SlotKind, role: string): string | null {
  if (role === "mythic") return null;
  const group = traitGroup(kind);
  if (group === "armor") return plan.armorTrait;
  if (group === "jewelry") return plan.jewelryTrait;
  if (group === "weapon") {
    if (slotId?.startsWith("back")) return plan.backTrait;
    return plan.frontTrait;
  }
  return null;
}

export function sameTrait(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a ?? "").toLowerCase().replace(/[^a-z]/g, "");
  const right = (b ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return left.length > 0 && left === right;
}

export function weightFromText(text: string | null | undefined): ArmorWeight | null {
  const blob = (text ?? "").toLowerCase();
  if (/\blight\b/.test(blob)) return "light";
  if (/\bmedium\b/.test(blob)) return "medium";
  if (/\bheavy\b/.test(blob)) return "heavy";
  return null;
}

/** Piece words that belong to one weight. Generic words such as Head do not. */
const WEIGHT_WORDS: readonly (readonly [string, ArmorWeight])[] = [
  ["arm cops", "medium"],
  ["epaulets", "light"],
  ["epaulet", "light"],
  ["pauldron", "heavy"],
  ["helmet", "medium"],
  ["cuirass", "heavy"],
  ["jerkin", "light"],
  ["gauntlets", "heavy"],
  ["gauntlet", "heavy"],
  ["bracers", "medium"],
  ["bracer", "medium"],
  ["breeches", "light"],
  ["sabatons", "heavy"],
  ["sabaton", "heavy"],
  ["greaves", "heavy"],
  ["gloves", "light"],
  ["glove", "light"],
  ["girdle", "heavy"],
  ["guards", "medium"],
  ["helmets", "medium"],
  ["robe", "light"],
  ["jack", "medium"],
  ["sash", "light"],
  ["belt", "medium"],
  ["helm", "heavy"],
  ["hat", "light"],
  ["boots", "medium"],
  ["boot", "medium"],
  ["shoes", "light"],
  ["shoe", "light"],
];

export function weightFromPieceName(name: string | null | undefined): ArmorWeight | null {
  const blob = (name ?? "").toLowerCase();
  if (!blob.trim()) return null;
  for (const [phrase, weight] of WEIGHT_WORDS) {
    const body = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${body}\\b`, "i").test(blob)) return weight;
  }
  return null;
}

/** Smithing line names for one armor slot at one weight. Light chests are Robe or Jerkin. */
const LINES: Record<ArmorWeight, Record<(typeof BODY_ARMOR)[number], readonly string[]>> = {
  light: {
    head: ["hat"],
    shoulders: ["epaulets"],
    chest: ["robe", "jerkin"],
    hands: ["gloves"],
    waist: ["sash"],
    legs: ["breeches"],
    feet: ["shoes"],
  },
  medium: {
    head: ["helmet"],
    shoulders: ["arm cops"],
    chest: ["jack"],
    hands: ["bracers"],
    waist: ["belt"],
    legs: ["guards"],
    feet: ["boots"],
  },
  heavy: {
    head: ["helm"],
    shoulders: ["pauldron"],
    chest: ["cuirass"],
    hands: ["gauntlets"],
    waist: ["girdle"],
    legs: ["greaves"],
    feet: ["sabatons"],
  },
};

export function researchLineNames(kind: SlotKind, weight: ArmorWeight | null, weaponLine: string | null): readonly string[] {
  if (weaponLine) return [weaponLine];
  if (kind === "neck") return ["necklace"];
  if (kind === "ring") return ["ring"];
  if (kind === "shield") return ["shield"];
  if (weight && isBodyArmor(kind)) return LINES[weight][kind];
  return [];
}

const ANY_WEIGHT = ["light", "medium", "heavy"] as const;

function unique(weights: readonly ArmorWeight[]): ArmorWeight[] {
  return ANY_WEIGHT.filter((weight) => weights.includes(weight));
}

/**
 * Which weights a set's body armor can be.
 *
 * Crafted sets, monster sets, and Cyrodiil sets can be any weight. A mythic
 * stays the weight of its piece. Anything else is one weight, unless the
 * collection already shows two: the game then offers all three, never exactly two.
 * No scanned armor piece means the weight is not known yet, so the list is empty
 * and reconstruction must not invent one. Callers that have not classified a
 * set leave the field unset, which means "do not block".
 */
export function weightsForSet(input: {
  crafted: boolean;
  mythic: boolean;
  monster: boolean;
  category: string;
  seen: readonly ArmorWeight[];
}): ArmorWeight[] {
  const seen = unique(input.seen);
  if (input.mythic) return seen;
  if (input.crafted || input.monster || anyWeightCategory(input.category)) return [...ANY_WEIGHT];
  if (seen.length >= 2) return [...ANY_WEIGHT];
  return seen;
}

function anyWeightCategory(category: string): boolean {
  const blob = category.toLowerCase();
  return blob.includes("cyrodiil") || blob.includes("battleground") || blob.includes("imperial city") || blob.includes("pvp");
}

export function setAllowsWeight(weights: readonly ArmorWeight[] | null | undefined, weight: ArmorWeight): boolean {
  if (weights == null) return true;
  return weights.includes(weight);
}
