import type { MorphSlot, SkillMorph } from "../snapshot/schema";

/** Live ESO cap for active/ultimate morph-slot ranks (MAX_RANKS_PER_ABILITY). */
export const MAX_ABILITY_RANK = 4;

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"] as const;

/** Rank as the game writes it (I–IV). Unknown/unpurchased is an em dash, never a guessed number. */
export function romanRank(rank: number | null | undefined): string {
  if (rank == null || rank <= 0) return "—";
  return ROMAN[rank - 1] ?? String(rank);
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

  const current = slots.find((s) => s.slot === ability.morph && s.purchased);
  if (current) {
    return { name: current.name, morphSlot: current.slot, showingMorph: current.slot > 0 };
  }

  const purchasedMorph = slots.find((s) => s.slot > 0 && s.purchased);
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
    morphSlot: 0,
    showingMorph: false,
  };
}

/** Names that count as "this character knows this ability" — purchased slots only. */
export function knownAbilityNames(ability: SkillMorph): string[] {
  const names: string[] = [];
  if (ability.purchased) names.push(ability.name);
  for (const slot of ability.morphs ?? []) {
    if (slot.purchased && slot.name) names.push(slot.name);
  }
  return names;
}

export function abilityIsKnown(ability: SkillMorph): boolean {
  if (ability.purchased) return true;
  return (ability.morphs ?? []).some((s) => s.purchased);
}

export function xpProgress(slot: MorphSlot): { value: number; max: number } | null {
  if (slot.xp == null || slot.xpMax == null) return null;
  const min = slot.xpMin ?? 0;
  const max = slot.xpMax - min;
  if (max <= 0) return null;
  const value = Math.max(0, slot.xp - min);
  return { value, max };
}
