/**
 * Weight and slot for an outfit style, the way the game's outfit station
 * filters them. The addon reports both when the client exposes them; older
 * snapshots fall back to the piece name, since every motif names its pieces
 * by weight (a light "Hat", a medium "Helmet", a heavy "Helm").
 */

export type OutfitWeight = "light" | "medium" | "heavy" | "special";
export type ArmorSlot = "head" | "shoulders" | "chest" | "hands" | "waist" | "legs" | "feet";
export type WeaponKind =
  | "axe"
  | "mace"
  | "sword"
  | "dagger"
  | "battleaxe"
  | "maul"
  | "greatsword"
  | "bow"
  | "destruction"
  | "restoration"
  | "shield";

export type OutfitFacets =
  | { kind: "armor"; weight: OutfitWeight; slot: ArmorSlot | null }
  | { kind: "weapon"; weapon: WeaponKind | null };

export const WEIGHTS: { id: OutfitWeight; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "medium", label: "Medium" },
  { id: "heavy", label: "Heavy" },
  { id: "special", label: "Special" },
];

export const ARMOR_SLOTS: { id: ArmorSlot; label: string }[] = [
  { id: "head", label: "Head" },
  { id: "shoulders", label: "Shoulders" },
  { id: "chest", label: "Chest" },
  { id: "hands", label: "Hands" },
  { id: "waist", label: "Waist" },
  { id: "legs", label: "Legs" },
  { id: "feet", label: "Feet" },
];

export const WEAPON_KINDS: { id: WeaponKind; label: string }[] = [
  { id: "axe", label: "Axe" },
  { id: "mace", label: "Mace" },
  { id: "sword", label: "Sword" },
  { id: "dagger", label: "Dagger" },
  { id: "battleaxe", label: "Battle axe" },
  { id: "maul", label: "Maul" },
  { id: "greatsword", label: "Greatsword" },
  { id: "bow", label: "Bow" },
  { id: "destruction", label: "Destruction staff" },
  { id: "restoration", label: "Restoration staff" },
  { id: "shield", label: "Shield" },
];

// Piece words per weight and slot. Longer words first where one contains another.
const ARMOR_WORDS: [RegExp, OutfitWeight, ArmorSlot][] = [
  [/\bhelmet\b/, "medium", "head"],
  [/\bhelm\b/, "heavy", "head"],
  [/\bhat\b/, "light", "head"],
  [/\bepaulets?\b/, "light", "shoulders"],
  [/\barm cops\b/, "medium", "shoulders"],
  [/\bpauldrons?\b/, "heavy", "shoulders"],
  [/\b(robe|jerkin)\b/, "light", "chest"],
  [/\bjack\b/, "medium", "chest"],
  [/\bcuirass\b/, "heavy", "chest"],
  [/\bgloves\b/, "light", "hands"],
  [/\bbracers\b/, "medium", "hands"],
  [/\bgauntlets\b/, "heavy", "hands"],
  [/\bsash\b/, "light", "waist"],
  [/\bbelt\b/, "medium", "waist"],
  [/\bgirdle\b/, "heavy", "waist"],
  [/\bbreeches\b/, "light", "legs"],
  [/\bguards\b/, "medium", "legs"],
  [/\bgreaves\b/, "heavy", "legs"],
  [/\bshoes\b/, "light", "feet"],
  [/\bboots\b/, "medium", "feet"],
  [/\bsabatons\b/, "heavy", "feet"],
];

// Slot words that say nothing about weight (costume-like pieces).
const SLOT_ONLY: [RegExp, ArmorSlot][] = [
  [/\b(hood|mask|cowl|crown|circlet|headdress|cap|visor)\b/, "head"],
  [/\b(shoulders?|mantle|spaulders?)\b/, "shoulders"],
  [/\b(chest|cuirasse|tunic|coat|vest|armor)\b/, "chest"],
  [/\b(hands?|wraps|gauntlet)\b/, "hands"],
  [/\b(waist|cinch|tassets)\b/, "waist"],
  [/\b(legs?|pants|trousers|leggings)\b/, "legs"],
  [/\b(feet|footwear|shoe|boot|sandals)\b/, "feet"],
];

const WEAPON_WORDS: [RegExp, WeaponKind][] = [
  [/\bbattle ?axe\b/, "battleaxe"],
  [/\bgreatsword\b/, "greatsword"],
  [/\bmaul\b/, "maul"],
  [/\b(inferno|ice|frost|lightning|flame|fire|shock|destruction) staff\b/, "destruction"],
  [/\b(restoration|healing) staff\b/, "restoration"],
  [/\bstaff\b/, "destruction"],
  [/\baxe\b/, "axe"],
  [/\bmace\b/, "mace"],
  [/\bsword\b/, "sword"],
  [/\bdagger\b/, "dagger"],
  [/\bbow\b/, "bow"],
  [/\bshield\b/, "shield"],
];

const WEIGHT_WORDS: Record<string, OutfitWeight> = { light: "light", medium: "medium", heavy: "heavy" };
const ADDON_SLOT: Record<string, ArmorSlot> = {
  head: "head",
  shoulders: "shoulders",
  chest: "chest",
  hands: "hands",
  waist: "waist",
  legs: "legs",
  feet: "feet",
};

export function outfitFacets(
  style: { name: string; weight?: string | null; slot?: string | null },
  categoryName = "",
): OutfitFacets {
  const name = style.name.toLowerCase();
  const cat = categoryName.toLowerCase();
  const addonSlot = style.slot?.toLowerCase() ?? "";

  const weaponCategory = /weapon/.test(cat);
  const addonWeapon = addonSlot.startsWith("weapon") || WEAPON_WORDS.some(([re]) => re.test(addonSlot));
  const named = WEAPON_WORDS.find(([re]) => re.test(name))?.[1] ?? null;
  const armorWord = ARMOR_WORDS.find(([re]) => re.test(name));
  if (weaponCategory || addonWeapon || (named && !armorWord)) {
    const fromAddon = WEAPON_WORDS.find(([re]) => re.test(addonSlot))?.[1] ?? null;
    return { kind: "weapon", weapon: fromAddon ?? named };
  }

  const weight =
    (style.weight && (WEIGHT_WORDS[style.weight.toLowerCase()] ?? (style.weight.toLowerCase() === "special" ? "special" : null))) ||
    armorWord?.[1] ||
    Object.entries(WEIGHT_WORDS).find(([w]) => cat.includes(w))?.[1] ||
    "special";
  const slot =
    ADDON_SLOT[addonSlot] ??
    armorWord?.[2] ??
    SLOT_ONLY.find(([re]) => re.test(name))?.[1] ??
    (/\b(hat|head)/.test(cat) ? "head" : null);
  return { kind: "armor", weight, slot };
}
