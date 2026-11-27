/** The Vault's sections, shown as tabs in the Party header. */
export const VAULT_SECTIONS = [
  { id: "", label: "Overview" },
  { id: "inventory", label: "Inventory" },
  { id: "sets", label: "Set collection" },
  { id: "achievements", label: "Achievements" },
  { id: "dailies", label: "Dailies" },
  { id: "crafting", label: "Crafting" },
  { id: "styles", label: "Outfit styles" },
  { id: "houses", label: "Houses" },
] as const;

export type VaultSection = (typeof VAULT_SECTIONS)[number]["id"];
