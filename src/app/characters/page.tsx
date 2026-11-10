import { Users } from "lucide-react";
import { getArchivedCharacters, getCharacters, getCharactersFull } from "@/lib/db/queries";
import { listAssignments, listRoles } from "@/lib/db/roles";
import { listGoals } from "@/lib/db/goals";
import type { RoleAssignments } from "@/lib/roles/types";
import { CharacterRoster } from "@/components/character-roster";
import { RoleManagerButton } from "@/components/role-manager";
import { LookSwitch } from "@/components/look-switch";
import { AtlasRoster, type RosterSort } from "@/components/atlas/roster";
import { presentCharacterWorkspaceCards } from "@/lib/characters/workspace";
import { buildGoalIndexes } from "@/lib/planner/data";
import { liveCharacters } from "@/lib/snapshot/roster";
import type { GoalIndexes } from "@/lib/goals/types";
import { Badge, EmptyState, PageFrame, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CharactersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sort: RosterSort = sp.sort === "name" ? "name" : "progress";

  let characters: ReturnType<typeof getCharacters> = [];
  let archived: ReturnType<typeof getArchivedCharacters> = [];
  let roles: ReturnType<typeof listRoles> = [];
  let assignments: RoleAssignments = {};
  try {
    characters = getCharacters();
    archived = getArchivedCharacters();
    roles = listRoles();
    assignments = listAssignments();
  } catch {
    characters = [];
    archived = [];
  }

  const accountCP = characters.reduce((m, c) => Math.max(m, c.championPoints ?? 0), 0);

  const goals = safe(() => listGoals()) ?? [];
  const indexArrays = safe(() => buildGoalIndexes());
  const indexes: GoalIndexes = {
    lines: new Map(indexArrays?.lineIndex ?? []),
    abilities: new Map(indexArrays?.abilityIndex ?? []),
  };
  const full = liveCharacters(safe(() => getCharactersFull()) ?? []);
  const cards = presentCharacterWorkspaceCards(full.length > 0 ? full : characters, goals, indexes);

  const classic =
    characters.length === 0 && archived.length === 0 ? (
      <PageFrame>
        <PageHeader
          title="Characters"
          subtitle="The live ESO roster."
          action={
            <div className="flex flex-wrap items-center gap-2">
              {accountCP > 0 ? (
                <Badge tone="accent">CP {accountCP.toLocaleString("en-US")} · account-wide</Badge>
              ) : null}
              <RoleManagerButton roles={roles} />
            </div>
          }
        />
        <EmptyState title="No characters yet" icon={<Users className="h-8 w-8" />}>
          Install the addon, log a character out or <code className="rounded bg-surface-2 px-1">/reloadui</code>, then
          import. Or run <code className="rounded bg-surface-2 px-1">npm run seed</code> to preview.
        </EmptyState>
      </PageFrame>
    ) : (
      <PageFrame>
        <PageHeader
          title="Characters"
          subtitle="The live ESO roster."
          action={
            <div className="flex flex-wrap items-center gap-2">
              {accountCP > 0 ? (
                <Badge tone="accent">CP {accountCP.toLocaleString("en-US")} · account-wide</Badge>
              ) : null}
              <RoleManagerButton roles={roles} />
            </div>
          }
        />
        <CharacterRoster
          characters={characters}
          archived={archived}
          roles={roles}
          assignments={assignments}
        />
      </PageFrame>
    );

  return (
    <LookSwitch
      classic={classic}
      atlas={
        <AtlasRoster
          cards={cards}
          sort={sort}
          accountCP={accountCP}
          action={<RoleManagerButton roles={roles} />}
        />
      }
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
