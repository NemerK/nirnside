import { getArchivedCharacters, getCharacters, getCharactersFull } from "@/lib/db/queries";
import { galleryCounts } from "@/lib/db/gallery";
import { listAssignments, listRoles } from "@/lib/db/roles";
import { listGoals } from "@/lib/db/goals";
import type { RoleAssignments } from "@/lib/roles/types";
import { RoleManagerButton } from "@/components/role-manager";
import { AtlasRoster, type RosterSort, type RosterView } from "@/components/atlas/roster";
import { presentCharacterWorkspaceCards } from "@/lib/characters/workspace";
import { applyRosterOrder, getRosterOrder } from "@/lib/roster/order";
import { buildGoalIndexes } from "@/lib/planner/data";
import { liveCharacters } from "@/lib/snapshot/roster";
import type { GoalIndexes } from "@/lib/goals/types";

export const dynamic = "force-dynamic";

export default async function CharactersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sort: RosterSort = sp.sort === "name" ? "name" : "progress";
  const view: RosterView = sp.view === "list" ? "list" : "cards";

  let characters: ReturnType<typeof getCharacters> = [];
  let roles: ReturnType<typeof listRoles> = [];
  let assignments: RoleAssignments = {};
  try {
    characters = getCharacters();
    roles = listRoles();
    assignments = listAssignments();
  } catch {
    characters = [];
  }

  const accountCP = characters.reduce((m, c) => Math.max(m, c.championPoints ?? 0), 0);

  const goals = safe(() => listGoals()) ?? [];
  const indexArrays = safe(() => buildGoalIndexes());
  const indexes: GoalIndexes = {
    lines: new Map(indexArrays?.lineIndex ?? []),
    abilities: new Map(indexArrays?.abilityIndex ?? []),
  };
  const full = liveCharacters(safe(() => getCharactersFull()) ?? []);
  const source = full.length > 0 ? full : characters;
  const cards = presentCharacterWorkspaceCards(source, goals, indexes, assignments, roles);
  const ordered = applyRosterOrder(cards, safe(() => getRosterOrder()) ?? []);
  const photoCounts = Object.fromEntries(safe(() => galleryCounts("character")) ?? []);

  return (
    <AtlasRoster
          cards={view === "list" ? ordered : cards}
          sort={sort}
          view={view}
          accountCP={accountCP}
          photoCounts={photoCounts}
          action={<RoleManagerButton roles={roles} />}
          archived={(safe(() => getArchivedCharacters()) ?? []).map((c) => ({
            id: c.id,
            name: c.name,
            className: c.class,
            archivedAt: c.archivedAt,
          }))}
        />
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
