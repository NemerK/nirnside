/**
 * Inventory tabs in the same order as the backpack window
 * (`BACKPACK_FILTER_KEYS` / `BACKPACK_SEARCH_FILTER_KEYS` in esoui
 * `inventory.lua`). Ids are stable. Labels are the English client's
 * filter strings, used only until a snapshot stores the client's own
 * `GetString` label.
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
