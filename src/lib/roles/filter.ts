import type { Character } from "../snapshot/schema";
import type { CharacterFilters, Role, RoleAssignments } from "./types";

export function rolesForCharacter(
  characterId: string,
  roles: Role[],
  assignments: RoleAssignments,
): Role[] {
  const ids = assignments[characterId] ?? [];
  if (ids.length === 0) return [];
  const byId = new Map(roles.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is Role => r != null);
}

export function characterMatches(
  c: Pick<Character, "id" | "name" | "class" | "race">,
  assigned: Role[],
  filters: CharacterFilters,
): boolean {
  if (filters.className && c.class !== filters.className) return false;
  if (filters.race && c.race !== filters.race) return false;
  if (filters.role === "none" && assigned.length > 0) return false;
  if (filters.role && filters.role !== "none" && !assigned.some((r) => r.id === filters.role)) return false;

  const q = filters.q?.trim().toLowerCase();
  if (!q) return true;
  const hay = [c.name, c.class, c.race, ...assigned.map((r) => r.name)].join(" ").toLowerCase();
  return hay.includes(q);
}

export function filterCharacters<T extends Pick<Character, "id" | "name" | "class" | "race">>(
  characters: T[],
  roles: Role[],
  assignments: RoleAssignments,
  filters: CharacterFilters,
): T[] {
  return characters.filter((c) => characterMatches(c, rolesForCharacter(c.id, roles, assignments), filters));
}
