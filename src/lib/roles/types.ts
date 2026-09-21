export interface Role {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

/** characterId → one or more role ids. Survives snapshot re-imports. */
export type RoleAssignments = Record<string, string[]>;

export interface CharacterFilters {
  /** Matches name, class, race, or assigned role name. */
  q?: string;
  className?: string;
  race?: string;
  /** Role id, or "none" for unassigned. */
  role?: string;
}

export const ROLE_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

export const SUGGESTED_ROLES: { name: string; color: string }[] = [
  { name: "Tank", color: "#3f7fd6" },
  { name: "Healer", color: "#4ba36a" },
  { name: "DPS", color: "#c0453b" },
  { name: "Crafter", color: "#c8a35a" },
];
