/**
 * The crafting professions (the game's tradeskills), in its crafting order: the three
 * equipment crafts, then enchanting, alchemy, provisioning and jewelry
 * crafting (the TradeskillType constants; ESOUI API 101051). Nirnside's keys
 * are its own; the names are the game's (SI_TRADESKILLTYPE), used until a
 * catalog entry carries the game's text itself.
 */
export const TRADESKILLS = [
  "blacksmithing",
  "clothing",
  "woodworking",
  "enchanting",
  "alchemy",
  "provisioning",
  "jewelry",
] as const;
export type Tradeskill = (typeof TRADESKILLS)[number];

export const TRADESKILL_NAMES: Record<Tradeskill, string> = {
  blacksmithing: "Blacksmithing",
  clothing: "Clothing",
  woodworking: "Woodworking",
  enchanting: "Enchanting",
  alchemy: "Alchemy",
  provisioning: "Provisioning",
  jewelry: "Jewelry Crafting",
};

export function isTradeskill(value: unknown): value is Tradeskill {
  return typeof value === "string" && (TRADESKILLS as readonly string[]).includes(value);
}
