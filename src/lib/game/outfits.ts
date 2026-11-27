/**
 * Weight and slot for an outfit style, the way the game's outfit station
 * filters them. The addon reports both when the client exposes them; older
 * snapshots fall back to the piece name, since every motif names its pieces
 * by weight (a light "Hat", a medium "Helmet", a heavy "Helm").
 */

import {
  ARMOR_SLOTS as GAME_SLOTS,
  SLOT_LABEL,
  WEAPON_LABEL,
  WEIGHTS as GAME_WEIGHTS,
  WEIGHT_LABEL,
  parseWornSlot,
  pieceKindFromName,
  pieceSlotFromText,
  weaponFromText,
  type ArmorSlot,
  type Weapon,
  type Weight,
} from "./equipment";

export type { ArmorSlot };
export type OutfitWeight = Weight | "special";
/** Weapon types as the outfit station groups them: one destruction staff. */
export type WeaponKind = Exclude<Weapon, "inferno" | "ice" | "lightning"> | "destruction";

export type OutfitFacets =
  | { kind: "armor"; weight: OutfitWeight; slot: ArmorSlot | null }
  | { kind: "weapon"; weapon: WeaponKind | null };

export const OUTFIT_WEIGHTS: { id: OutfitWeight; label: string }[] = [
  ...GAME_WEIGHTS.map((id) => ({ id, label: WEIGHT_LABEL[id] })),
  { id: "special", label: "Special" },
];

export const OUTFIT_SLOTS: { id: ArmorSlot; label: string }[] = GAME_SLOTS.map((id) => ({ id, label: SLOT_LABEL[id] }));

/** The outfit station groups the three destruction staves as one weapon type. */
export const WEAPON_KINDS: { id: WeaponKind; label: string }[] = [
  ...(["axe", "mace", "sword", "dagger", "battleaxe", "maul", "greatsword", "bow"] as const).map((id) => ({
    id,
    label: WEAPON_LABEL[id],
  })),
  { id: "destruction", label: "Destruction staff" },
  { id: "restoration", label: "Restoration staff" },
  { id: "shield", label: "Shield" },
];

// Costume-like pieces have a slot but no weight: the model's slot-only words (equipment.ts) name it.
function slotOnly(name: string): ArmorSlot | null {
  const piece = pieceSlotFromText(name);
  return piece?.kind === "armor" ? piece.slot : null;
}

function toOutfitWeapon(w: Weapon): WeaponKind {
  return w === "inferno" || w === "ice" || w === "lightning" ? "destruction" : w;
}

export function outfitFacets(
  style: { name: string; weight?: string | null; slot?: string | null },
  categoryName = "",
): OutfitFacets {
  const name = style.name.toLowerCase();
  const cat = categoryName.toLowerCase();
  const addonSlot = (style.slot ?? "").toLowerCase();

  // Weapons: the addon's "weapon…" slot, a weapon category, or a weapon named in the style.
  const named = weaponFromText(name) ?? (/\bstaff\b/.test(name) ? "inferno" : null);
  const fromName = pieceKindFromName(style.name);
  const armorByName = fromName?.kind === "armor" ? fromName : null;
  if (addonSlot.startsWith("weapon") || /weapon/.test(cat) || (named && !armorByName)) {
    const fromAddon = weaponFromText(addonSlot.replace(/^weapon-?/, ""));
    const w = fromAddon ?? named;
    return { kind: "weapon", weapon: w ? toOutfitWeapon(w) : null };
  }

  const reported = (style.weight ?? "").toLowerCase();
  const weight: OutfitWeight =
    (GAME_WEIGHTS as readonly string[]).includes(reported) || reported === "special"
      ? (reported as OutfitWeight)
      : (armorByName?.weight ?? GAME_WEIGHTS.find((w) => cat.includes(w)) ?? "special");
  const slot =
    parseWornSlot(addonSlot) && (GAME_SLOTS as readonly string[]).includes(parseWornSlot(addonSlot)!)
      ? (parseWornSlot(addonSlot) as ArmorSlot)
      : (armorByName?.slot ?? slotOnly(name) ?? (/\b(hat|head)/.test(cat) ? "head" : null));
  return { kind: "armor", weight, slot };
}
