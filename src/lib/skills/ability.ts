import type { MorphSlot, SkillMorph } from "../snapshot/schema";

/** Live ESO cap for active/ultimate morph-slot ranks (MAX_RANKS_PER_ABILITY). */
export const MAX_ABILITY_RANK = 4;

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;

/**
 * Rank as the game writes it (I–IV). 0 is a real "not ranked yet" value.
 * Only a missing rank is an em dash — never a guessed number.
 */
export function romanRank(rank: number | null | undefined): string {
  if (rank == null) return "—";
  if (rank <= 0) return "0";
  return ROMAN[rank - 1] ?? String(rank);
}

/**
 * A slot counts as purchased only with a real rank (I+).
 * Older snapshots marked the base purchased whenever the API returned a
 * non-nil rank of 0 — that is an unpurchased skill, not a bought base.
 */
export function morphSlotPurchased(slot: { purchased?: boolean; rank?: number | null }): boolean {
  if (!slot.purchased) return false;
  return (slot.rank ?? 0) >= 1;
}

export function slotLabel(slot: number): string {
  if (slot <= 0) return "Base";
  return `Morph ${slot}`;
}

/**
 * The name to show for an ability on a character sheet:
 *   - currently slotted morph, if that slot is purchased
 *   - otherwise a purchased morph (1 then 2)
 *   - otherwise the base
 *
 * Older snapshots have no morphs[] — fall back to the recorded name.
 */
export function displayAbility(ability: SkillMorph): {
  name: string;
  morphSlot: number | null;
  showingMorph: boolean;
} {
  const slots = ability.morphs ?? [];
  if (slots.length === 0) {
    const morphSlot = ability.morph;
    return {
      name: ability.name,
      morphSlot,
      showingMorph: ability.purchased && (morphSlot ?? 0) > 0,
    };
  }

  const current = slots.find((s) => s.slot === ability.morph && morphSlotPurchased(s));
  if (current) {
    return { name: current.name, morphSlot: current.slot, showingMorph: current.slot > 0 };
  }

  const purchasedMorph = slots.find((s) => s.slot > 0 && morphSlotPurchased(s));
  if (purchasedMorph) {
    return {
      name: purchasedMorph.name,
      morphSlot: purchasedMorph.slot,
      showingMorph: true,
    };
  }

  const base = slots.find((s) => s.slot === 0);
  return {
    name: base?.name ?? ability.name,
    morphSlot: base ? 0 : null,
    showingMorph: false,
  };
}

/** Names that count as "this character knows this ability" — purchased slots only. */
export function knownAbilityNames(ability: SkillMorph): string[] {
  const names: string[] = [];
  const slots = ability.morphs ?? [];
  if (slots.length === 0) {
    if (abilityIsKnown(ability)) names.push(ability.name);
    return names;
  }
  for (const slot of slots) {
    if (morphSlotPurchased(slot) && slot.name) names.push(slot.name);
  }
  return names;
}

export function abilityIsKnown(ability: SkillMorph): boolean {
  const slots = ability.morphs ?? [];
  if (slots.length > 0) return slots.some(morphSlotPurchased);
  // Passives and older snapshots: a bought skill always has rank I or higher.
  return ability.purchased === true && (ability.rank ?? 0) >= 1;
}

export function xpProgress(slot: MorphSlot): { value: number; max: number } | null {
  if (slot.xp == null || slot.xpMax == null) return null;
  const min = slot.xpMin ?? 0;
  const max = slot.xpMax - min;
  if (max <= 0) return null;
  const value = Math.max(0, slot.xp - min);
  return { value, max };
}
