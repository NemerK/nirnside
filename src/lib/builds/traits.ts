import { ARMOR_TRAITS, JEWELRY_TRAITS, WEAPON_TRAITS } from "../game/traits";
import {
  ARMOR_SLOTS,
  WEIGHTS,
  WEIGHT_LABEL,
  pieceSlotFromText,
  researchLineNames as pieceResearchLines,
  type Weight,
} from "../game/equipment";
import type { SlotKind } from "./slots";

/**
 * Trait and armor-weight choices for a build.
 *
 * The lists are the live research grid: nine armor traits (shields included),
 * nine weapon traits, and nine jewelry traits. Jewelry cannot be Divines.
 * A shield uses armor traits. Weight is Light, Medium, or Heavy, and only
 * body armor has one. Weapons and jewelry do not.
 */
export type ArmorWeight = Weight;

export const ARMOR_WEIGHTS: readonly { id: ArmorWeight; label: string }[] = WEIGHTS.map((id) => ({ id, label: WEIGHT_LABEL[id] }));

// The trait lists live in the game model, in the research grid's order.
export { ARMOR_TRAITS, JEWELRY_TRAITS, WEAPON_TRAITS };

/** The seven armor slots: head, shoulders, chest, hands, waist, legs, feet. */
export const ARMOR_SLOT_COUNT = ARMOR_SLOTS.length;

export interface WeightMix {
  heavy: number;
  medium: number;
  light: number;
}

export interface TraitPlan extends WeightMix {
  armorTrait: string;
  jewelryTrait: string;
  frontTrait: string;
  backTrait: string;
  /** A trait aimed at one slot. Slots left out use the group trait above. */
  slotTraits?: Readonly<Record<string, string>>;
}

export function mixFor(weight: ArmorWeight): WeightMix {
  return {
    heavy: weight === "heavy" ? ARMOR_SLOT_COUNT : 0,
    medium: weight === "medium" ? ARMOR_SLOT_COUNT : 0,
    light: weight === "light" ? ARMOR_SLOT_COUNT : 0,
  };
}

export function defaultTraitPlan(): TraitPlan {
  return {
    ...mixFor("medium"),
    armorTrait: "Divines",
    jewelryTrait: "Bloodthirsty",
    frontTrait: "Infused",
    backTrait: "Infused",
    slotTraits: {},
  };
}

const SLOT_TRAIT_IDS = new Set([
  "head",
  "shoulders",
  "chest",
  "hands",
  "waist",
  "legs",
  "feet",
  "neck",
  "ring1",
  "ring2",
  "frontBar",
  "frontMain",
  "frontOff",
  "backBar",
  "backMain",
  "backOff",
]);

/** Traits a slot is allowed to aim at. An off hand may be a weapon or a shield. */
export function traitsForSlot(slotId: string): readonly string[] {
  if (slotId === "neck" || slotId === "ring1" || slotId === "ring2") return JEWELRY_TRAITS;
  if (slotId === "frontOff" || slotId === "backOff") return [...WEAPON_TRAITS, ...ARMOR_TRAITS];
  if (slotId.startsWith("front") || slotId.startsWith("back")) return WEAPON_TRAITS;
  return ARMOR_TRAITS;
}

/** Keep only real slot ids and traits that slot can wear. */
export function normalizeSlotTraits(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, string> = {};
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!SLOT_TRAIT_IDS.has(id) || typeof raw !== "string") continue;
    const match = traitsForSlot(id).find((trait) => sameTrait(trait, raw));
    if (match) out[id] = match;
  }
  return out;
}

/** The weight the mix asks for most. A tie prefers medium, then heavy. */
export function dominantWeight(mix: WeightMix): ArmorWeight {
  const ranked: ArmorWeight[] = ["medium", "heavy", "light"];
  ranked.sort((a, b) => mix[b] - mix[a]);
  return ranked[0] ?? "medium";
}

/**
 * Move one piece between weights and keep the seven-piece total.
 * Adding a weight takes it from the largest of the other two.
 * Removing a weight gives it to medium, or to the other weight when medium is the one changing.
 */
export function stepMix(mix: WeightMix, which: ArmorWeight, delta: 1 | -1): WeightMix {
  const next = { ...mix };
  if (delta > 0) {
    if (next[which] >= ARMOR_SLOT_COUNT) return mix;
    const donors = (["heavy", "medium", "light"] as const).filter((key) => key !== which && next[key] > 0);
    if (donors.length === 0) return mix;
    donors.sort((a, b) => next[b] - next[a] || (a === "medium" ? -1 : b === "medium" ? 1 : 0));
    const donor = donors[0]!;
    next[which] += 1;
    next[donor] -= 1;
    return next;
  }
  if (next[which] <= 0) return mix;
  const receiver: ArmorWeight = which === "medium" ? (next.light >= next.heavy ? "light" : "heavy") : "medium";
  next[which] -= 1;
  next[receiver] += 1;
  return next;
}

export function isArmorWeight(value: unknown): value is ArmorWeight {
  return (WEIGHTS as readonly unknown[]).includes(value);
}

export function weightLabel(weight: ArmorWeight): string {
  return ARMOR_WEIGHTS.find((row) => row.id === weight)?.label ?? weight;
}

const BODY_ARMOR = ARMOR_SLOTS;

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

/** The trait this slot is aiming for. A mythic has none. A pinned slot trait wins over the group. */
export function traitFor(plan: TraitPlan, slotId: string | null, kind: SlotKind, role: string): string | null {
  if (role === "mythic") return null;
  const group = traitGroup(kind);
  const pinned = slotId ? plan.slotTraits?.[slotId] : undefined;
  const allowed = traitsFor(kind);
  if (pinned && allowed.some((trait) => sameTrait(trait, pinned))) {
    return allowed.find((trait) => sameTrait(trait, pinned)) ?? pinned;
  }
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

/** The weight a piece name gives, by the game's piece words (Guards are medium). Generic words such as Head give none. */
export function weightFromPieceName(name: string | null | undefined): ArmorWeight | null {
  const piece = pieceSlotFromText(name);
  return piece?.kind === "armor" ? piece.weight : null;
}

/** Smithing line names, lowercase, from the game model. Light chests are Robe or Jerkin. */
export function researchLineNames(kind: SlotKind, weight: ArmorWeight | null, weaponLine: string | null): readonly string[] {
  if (weaponLine) return [weaponLine];
  if (kind === "neck") return ["necklace"];
  if (kind === "ring") return ["ring"];
  if (kind === "shield") return ["shield"];
  if (weight && isBodyArmor(kind)) {
    return pieceResearchLines({ kind: "armor", weight, slot: kind }).map((name) => name.toLowerCase());
  }
  return [];
}

const ANY_WEIGHT = WEIGHTS;

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
