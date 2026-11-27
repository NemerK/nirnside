/**
 * Party's areas, each with its own tabs in the header. Account holds what the
 * whole account shares; Across characters answers "who still has to…" and
 * "who can…"; character pages hold what one character has.
 */
export const ACCOUNT_SECTIONS = [
  { id: "", label: "Overview" },
  { id: "inventory", label: "Inventory" },
  { id: "sets", label: "Set collection" },
  { id: "styles", label: "Outfit styles" },
  { id: "houses", label: "Houses" },
  { id: "achievements", label: "Achievements" },
] as const;

export const ACROSS_SECTIONS = [
  { id: "skills", label: "Skill lines" },
  { id: "dailies", label: "Dailies" },
  { id: "crafting", label: "Crafting" },
  { id: "targets", label: "Targets" },
] as const;

export type AccountSection = Exclude<(typeof ACCOUNT_SECTIONS)[number]["id"], "">;

/** Every section the shared section module renders (account-wide and across). */
export type VaultSection = AccountSection | "dailies" | "crafting" | "";
