import type { FrontWeapon } from "./slots";
import { defaultTraitPlan, type ArmorWeight, type TraitPlan } from "./traits";

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
  weight: ArmorWeight;
  armorTrait: string;
  jewelryTrait: string;
  frontTrait: string;
  backTrait: string;
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
  };
}

export function traitPlanOf(build: TraitPlan): TraitPlan {
  const base = defaultTraitPlan();
  return {
    weight: build.weight ?? base.weight,
    armorTrait: build.armorTrait || base.armorTrait,
    jewelryTrait: build.jewelryTrait || base.jewelryTrait,
    frontTrait: build.frontTrait || base.frontTrait,
    backTrait: build.backTrait || base.backTrait,
  };
}
