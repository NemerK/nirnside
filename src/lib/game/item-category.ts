import type { PieceKind, Weapon } from "./equipment";

/**
 * Where every item belongs: the game's own inventory tabs.
 *
 * The tabs and their order are the backpack window's
 * (`BACKPACK_FILTER_KEYS` / `BACKPACK_SEARCH_FILTER_KEYS` in esoui
 * `inventory.lua`). Ids are stable. Labels are the English client's filter
 * strings, used only until a snapshot stores the client's own `GetString`
 * label.
 *
 * Each item is filed by `itemPlace`, in this order:
 * 1. the tab the game itself put it in (the addon asks the game's own
 *    filter, ZO_ItemFilterUtils, for each stack);
 * 2. for gear the game didn't file (older saves, worn gear, the set
 *    collection), the tab its piece kind belongs in;
 * 3. otherwise no place. A name counts only through the model's parser of
 *    the game's piece words (pieceKindFromName), never by guessing.
 * The game's item type ("Food", "Style Material") is kept beside it.
 */
export interface BagFilter {
  id: string;
  label: string;
  subs: { id: string; label: string }[];
}

export const BAG_CATEGORIES: BagFilter[] = [
  {
    id: "weapons",
    label: "Weapons",
    subs: [
      { id: "one-handed", label: "One-Handed" },
      { id: "two-handed", label: "Two-Handed" },
      { id: "bow", label: "Bow" },
      { id: "destruction-staff", label: "Destruction Staff" },
      { id: "restoration-staff", label: "Restoration Staff" },
    ],
  },
  {
    id: "apparel",
    label: "Apparel",
    subs: [
      { id: "light", label: "Light Armor" },
      { id: "medium", label: "Medium Armor" },
      { id: "heavy", label: "Heavy Armor" },
      { id: "shield", label: "Shield" },
    ],
  },
  {
    id: "jewelry",
    label: "Jewelry",
    subs: [
      { id: "neck", label: "Neck" },
      { id: "ring", label: "Ring" },
    ],
  },
  {
    id: "consumables",
    label: "Consumables",
    subs: [
      { id: "food", label: "Food" },
      { id: "drink", label: "Drink" },
      { id: "recipe", label: "Recipe" },
      { id: "potion", label: "Potion" },
      { id: "poison", label: "Poison" },
      { id: "style-motif", label: "Style Motif" },
      { id: "master-writ", label: "Master Writ" },
      { id: "container", label: "Container" },
      { id: "repair", label: "Repair" },
      { id: "crown", label: "Crown Item" },
      { id: "miscellaneous", label: "Miscellaneous" },
    ],
  },
  {
    id: "materials",
    label: "Materials",
    subs: [
      { id: "blacksmithing", label: "Blacksmithing" },
      { id: "clothing", label: "Clothing" },
      { id: "woodworking", label: "Woodworking" },
      { id: "jewelry-crafting", label: "Jewelry Crafting" },
      { id: "alchemy", label: "Alchemy" },
      { id: "enchanting", label: "Enchanting" },
      { id: "provisioning", label: "Provisioning" },
      { id: "style-material", label: "Style Material" },
      { id: "trait", label: "Trait Material" },
      { id: "furnishing-material", label: "Furnishing Material" },
    ],
  },
  {
    id: "furnishings",
    label: "Furnishings",
    subs: [
      { id: "crafting-station", label: "Crafting Station" },
      { id: "target-dummy", label: "Target Dummy" },
      { id: "lighting", label: "Lighting" },
      { id: "seating", label: "Seating" },
      { id: "ornamental", label: "Ornamental" },
    ],
  },
  {
    id: "companion",
    label: "Companion",
    subs: [
      { id: "weapons", label: "Weapons" },
      { id: "apparel", label: "Apparel" },
      { id: "jewelry", label: "Jewelry" },
    ],
  },
  {
    id: "miscellaneous",
    label: "Miscellaneous",
    subs: [
      { id: "appearance", label: "Appearance" },
      { id: "glyph", label: "Glyph" },
      { id: "soul-gem", label: "Soul Gem" },
      { id: "siege", label: "Siege" },
      { id: "tool", label: "Tool" },
      { id: "trophy", label: "Trophy" },
      { id: "lure", label: "Lure" },
      { id: "trash", label: "Trash" },
      { id: "miscellaneous", label: "Miscellaneous" },
    ],
  },
  { id: "junk", label: "Junk", subs: [] },
];

export function bagCategoryLabel(id: string | null | undefined, fromClient?: string | null): string {
  if (fromClient && fromClient.trim()) return fromClient.trim();
  return BAG_CATEGORIES.find((row) => row.id === id)?.label ?? "";
}

export function tallyBagFilters(
  items: {
    bagCategory?: string | null;
    bagSubtype?: string | null;
    bagCategoryLabel?: string | null;
    bagSubtypeLabel?: string | null;
  }[],
): {
  counts: Record<string, { total: number; subs: Record<string, number> }>;
  labels: Record<string, string>;
} {
  const counts: Record<string, { total: number; subs: Record<string, number> }> = {};
  const labels: Record<string, string> = {};
  for (const cat of BAG_CATEGORIES) counts[cat.id] = { total: 0, subs: {} };
  for (const it of items) {
    if (!it.bagCategory || !counts[it.bagCategory]) continue;
    counts[it.bagCategory].total += 1;
    if (it.bagCategoryLabel) labels[it.bagCategory] = it.bagCategoryLabel;
    if (it.bagSubtype) {
      counts[it.bagCategory].subs[it.bagSubtype] = (counts[it.bagCategory].subs[it.bagSubtype] ?? 0) + 1;
      if (it.bagSubtypeLabel) labels[`${it.bagCategory}:${it.bagSubtype}`] = it.bagSubtypeLabel;
    }
  }
  return { counts, labels };
}

export function bagSubtypeLabel(
  categoryId: string | null | undefined,
  subtypeId: string | null | undefined,
  fromClient?: string | null,
): string {
  if (fromClient && fromClient.trim()) return fromClient.trim();
  const cat = BAG_CATEGORIES.find((row) => row.id === categoryId);
  return cat?.subs.find((row) => row.id === subtypeId)?.label ?? "";
}

export type PlaceSource = "game" | "piece";

export interface ItemPlace {
  /** A BAG_CATEGORIES id: "weapons", "consumables", … */
  category: string;
  /** A sub id inside it: "two-handed", "food", …; null when the game gave none. */
  subtype: string | null;
  /** The game's item type label ("Food"), when the addon read it. */
  typeLabel: string | null;
  /** The game's finer kind (SPECIALIZED_ITEMTYPE_*), when read. */
  specializedLabel: string | null;
  from: PlaceSource;
}

export interface PlaceInput {
  bagCategory?: string | null;
  bagSubtype?: string | null;
  itemTypeLabel?: string | null;
  specializedTypeLabel?: string | null;
  /** Companion gear has its own tab. */
  companion?: boolean;
}

const WEAPON_SUB: Record<Exclude<Weapon, "shield">, string> = {
  axe: "one-handed",
  mace: "one-handed",
  sword: "one-handed",
  dagger: "one-handed",
  battleaxe: "two-handed",
  maul: "two-handed",
  greatsword: "two-handed",
  bow: "bow",
  inferno: "destruction-staff",
  ice: "destruction-staff",
  lightning: "destruction-staff",
  restoration: "restoration-staff",
};

/** The tab a piece kind belongs in, as the game files gear. */
export function placeOfPiece(kind: PieceKind, companion = false): { category: string; subtype: string | null } {
  let category: string;
  let subtype: string | null;
  if (kind.kind === "armor") {
    category = "apparel";
    subtype = kind.weight;
  } else if (kind.kind === "jewelry") {
    category = "jewelry";
    subtype = kind.jewelry === "necklace" ? "neck" : "ring";
  } else if (kind.weapon === "shield") {
    category = "apparel";
    subtype = "shield";
  } else {
    category = "weapons";
    subtype = WEAPON_SUB[kind.weapon];
  }
  if (!companion) return { category, subtype };
  return { category: "companion", subtype: category };
}

export function itemPlace(item: PlaceInput, kind: PieceKind | null = null): ItemPlace | null {
  const typeLabel = item.itemTypeLabel?.trim() || null;
  const specializedLabel = item.specializedTypeLabel?.trim() || null;
  if (item.bagCategory && BAG_CATEGORIES.some((c) => c.id === item.bagCategory)) {
    return { category: item.bagCategory, subtype: item.bagSubtype ?? null, typeLabel, specializedLabel, from: "game" };
  }
  if (kind) return { ...placeOfPiece(kind, item.companion), typeLabel, specializedLabel, from: "piece" };
  return null;
}
