import type { Character } from "../snapshot/schema";
import { CLASSES } from "../game/classes";
import { ALLIANCES, RACES, findAlliance, findRace } from "../game/character";
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

type Filterable = Pick<Character, "id" | "name" | "class" | "race"> & { alliance?: string | null };

export function characterMatches(c: Filterable, assigned: Role[], filters: CharacterFilters): boolean {
  if (filters.className && c.class !== filters.className) return false;
  // Race and alliance compare through the game model, so "Altmer" and "High Elf" are one race.
  if (filters.race && (findRace(c.race)?.name ?? c.race) !== (findRace(filters.race)?.name ?? filters.race)) return false;
  if (filters.alliance && findAlliance(c.alliance) !== findAlliance(filters.alliance)) return false;
  if (filters.role === "none" && assigned.length > 0) return false;
  if (filters.role && filters.role !== "none" && !assigned.some((r) => r.id === filters.role)) return false;

  const q = filters.q?.trim().toLowerCase();
  if (!q) return true;
  const hay = [c.name, c.class, c.race, ...assigned.map((r) => r.name)].join(" ").toLowerCase();
  return hay.includes(q);
}

export function filterCharacters<T extends Filterable>(
  characters: T[],
  roles: Role[],
  assignments: RoleAssignments,
  filters: CharacterFilters,
): T[] {
  return characters.filter((c) => characterMatches(c, rolesForCharacter(c.id, roles, assignments), filters));
}

/** Filters as the roster's URL carries them (q, class, race, alliance, role). */
export function filtersFromParams(sp: Record<string, string | string[] | undefined>): CharacterFilters {
  const one = (k: string) => {
    const v = sp[k];
    const s = (Array.isArray(v) ? v[0] : v)?.trim();
    return s ? s : undefined;
  };
  return { q: one("q"), className: one("class"), race: one("race"), alliance: one("alliance"), role: one("role") };
}

export function anyFilter(f: CharacterFilters): boolean {
  return !!(f.q || f.className || f.race || f.alliance || f.role);
}

export interface FilterChoices {
  classes: string[];
  races: string[];
  alliances: string[];
  roles: { id: string; name: string }[];
}

/**
 * What the roster can be filtered by: only values some character has, in the
 * game's order (classes as at character creation, races by alliance, the
 * three alliances). Roles are the player's own, plus "No role" when someone
 * has none.
 */
export function filterChoices(characters: Filterable[], roles: Role[], assignments: RoleAssignments): FilterChoices {
  const has = (list: readonly string[], values: (string | null | undefined)[]) => {
    const present = new Set(values.filter((v): v is string => !!v));
    const known = list.filter((x) => present.has(x));
    return [...known, ...[...present].filter((v) => !list.includes(v)).sort()];
  };
  const usedRoles = new Set(characters.flatMap((c) => assignments[c.id] ?? []));
  const unassigned = characters.some((c) => (assignments[c.id] ?? []).length === 0);
  return {
    classes: has(CLASSES, characters.map((c) => c.class)),
    races: has(
      RACES.map((r) => r.name),
      characters.map((c) => findRace(c.race)?.name ?? c.race),
    ),
    alliances: has(ALLIANCES, characters.map((c) => findAlliance(c.alliance) ?? c.alliance)),
    roles: [
      ...roles.filter((r) => usedRoles.has(r.id)).map((r) => ({ id: r.id, name: r.name })),
      ...(unassigned && usedRoles.size > 0 ? [{ id: "none", name: "No role" }] : []),
    ],
  };
}
