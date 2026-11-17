export const CHARACTER_TABS = ["overview", "equipped", "setups", "targets", "scripts", "cp"] as const;

export type CharacterTabId = (typeof CHARACTER_TABS)[number];

export function characterTab(value: string | undefined): CharacterTabId {
  return (CHARACTER_TABS as readonly string[]).includes(value ?? "") ? (value as CharacterTabId) : "overview";
}
