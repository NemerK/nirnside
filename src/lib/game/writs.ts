/**
 * Crafting writs: one daily writ per crafting profession, from that
 * profession's writ board, once the character has certified in it.
 * Source: UESP Online:Crafting Writs.
 *
 * The order is the game's crafting order: the three equipment crafts, then
 * enchanting, alchemy, provisioning, and jewelry crafting.
 */
export const WRIT_CRAFTS = [
  "blacksmithing",
  "clothing",
  "woodworking",
  "enchanting",
  "alchemy",
  "provisioning",
  "jewelry",
] as const;
export type WritCraft = (typeof WRIT_CRAFTS)[number];

/** Who the writ is for, as the game names the writ ("Blacksmith Writ"). */
export const WRIT_LABELS: Record<WritCraft, string> = {
  blacksmithing: "Blacksmith",
  clothing: "Clothier",
  woodworking: "Woodworker",
  enchanting: "Enchanter",
  alchemy: "Alchemist",
  provisioning: "Provisioner",
  jewelry: "Jewelry",
};
