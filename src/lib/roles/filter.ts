import type { Character } from "../snapshot/schema";
import type { CharacterFilters, Role } from "./types";

export function roleForCharacter(
  characterId: string,
  roles: Role[],
  assignments: Record<string, string>,
): Role | null {
  const id = assignments[characterId];
  if (!id) return null;
  return roles.find((r) => r.id === id) ?? null;
}

export function characterMatches(
  c: Pick<Character, "id" | "name" | "class" | "race">,
  role: Role | null,
  filters: CharacterFilters,
): boolean {
  if (filters.className && c.class !== filters.className) return false;
  if (filters.race && c.race !== filters.race) return false;
  if (filters.role === "none" && role) return false;
  if (filters.role && filters.role !== "none" && role?.id !== filters.role) return false;

  const q = filters.q?.trim().toLowerCase();
  if (!q) return true;
  const hay = [c.name, c.class, c.race, role?.name ?? ""].join(" ").toLowerCase();
  return hay.includes(q);
}

export function filterCharacters<T extends Pick<Character, "id" | "name" | "class" | "race">>(
  characters: T[],
  roles: Role[],
  assignments: Record<string, string>,
  filters: CharacterFilters,
): T[] {
  return characters.filter((c) =>
    characterMatches(c, roleForCharacter(c.id, roles, assignments), filters),
  );
}
