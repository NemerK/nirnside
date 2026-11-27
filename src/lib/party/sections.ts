/** The pages of one character, in tab order. "" is the overview sheet. */
export const CHARACTER_SECTIONS = [
  { id: "", label: "Overview" },
  { id: "skills", label: "Skills" },
  { id: "gear", label: "Gear and setups" },
  { id: "champion", label: "Champion Points" },
  { id: "crafting", label: "Crafting" },
] as const;

export type CharacterSectionId = Exclude<(typeof CHARACTER_SECTIONS)[number]["id"], "">;

export function isCharacterSection(id: string): id is CharacterSectionId {
  return id !== "" && CHARACTER_SECTIONS.some((s) => s.id === id);
}

export function sectionLabel(id: CharacterSectionId): string {
  return CHARACTER_SECTIONS.find((s) => s.id === id)?.label ?? id;
}
