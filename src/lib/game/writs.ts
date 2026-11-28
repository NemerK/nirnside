import { TRADESKILLS, type Tradeskill } from "./tradeskills";

/**
 * Crafting writs: one daily writ per crafting profession, from that
 * profession's writ board, once the character has certified in it.
 * Source: UESP Online:Crafting Writs.
 *
 * One writ per craft, in the game's crafting order (tradeskills.ts).
 */
export const WRIT_CRAFTS = TRADESKILLS;
export type WritCraft = Tradeskill;

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
