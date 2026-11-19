import type { FrontWeapon } from "./slots";
import { defaultTraitPlan, normalizeSlotTraits, type TraitPlan } from "./traits";

/** A gear build the player saved. Not part of the ESO snapshot. */
export interface SavedBuild {
  id: string;
  name: string;
  createdAt: number;
  bodySetId: number | null;
  bodyName: string | null;
  monsterSetId: number | null;
  monsterName: string | null;
  monsterPieces: 1 | 2;
  mythicSetId: number | null;
  mythicName: string | null;
  frontSetId: number | null;
  frontName: string | null;
  /** Chosen front-bar weapon. Null leaves the choice to the arranger. */
  frontMain: FrontWeapon | null;
  /** Off hand when the main hand is one-handed. Null when the main hand is a two-hander. */
  frontOff: FrontWeapon | null;
  backSetId: number | null;
  backName: string | null;
  /** How many of the seven armor slots should be heavy, medium, and light. */
  heavy: number;
  medium: number;
  light: number;
  armorTrait: string;
  jewelryTrait: string;
  frontTrait: string;
  backTrait: string;
  /** Trait aimed at one slot. Empty means every slot uses the group trait. */
  slotTraits: Record<string, string>;
}

export function emptyBuild(): Omit<SavedBuild, "id" | "name" | "createdAt"> {
  return {
    bodySetId: null,
    bodyName: null,
    monsterSetId: null,
    monsterName: null,
    monsterPieces: 2,
    mythicSetId: null,
    mythicName: null,
    frontSetId: null,
    frontName: null,
    frontMain: null,
    frontOff: null,
    backSetId: null,
    backName: null,
    ...defaultTraitPlan(),
    slotTraits: {},
  };
}

export function traitPlanOf(build: TraitPlan): TraitPlan {
  const base = defaultTraitPlan();
  return {
    heavy: mixCount(build.heavy, base.heavy),
    medium: mixCount(build.medium, base.medium),
    light: mixCount(build.light, base.light),
    armorTrait: build.armorTrait || base.armorTrait,
    jewelryTrait: build.jewelryTrait || base.jewelryTrait,
    frontTrait: build.frontTrait || base.frontTrait,
    backTrait: build.backTrait || base.backTrait,
    slotTraits: normalizeSlotTraits(build.slotTraits),
  };
}

function mixCount(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(7, Math.round(value)));
}
