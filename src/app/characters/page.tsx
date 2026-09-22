import { Users } from "lucide-react";
import { getArchivedCharacters, getCharacters } from "@/lib/db/queries";
import { listAssignments, listRoles } from "@/lib/db/roles";
import type { RoleAssignments } from "@/lib/roles/types";
import { CharacterRoster } from "@/components/character-roster";
import { RoleManagerButton } from "@/components/role-manager";
import { Badge, EmptyState, PageFrame, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function CharactersPage() {
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

  return (
    <PageFrame>
      <PageHeader
        title="Characters"
        subtitle="The live ESO roster. Tag toons with one or more roles, then filter by name, class, race, or role."
        action={
          <div className="flex flex-wrap items-center gap-2">
            {accountCP > 0 ? (
              <Badge tone="accent">CP {accountCP.toLocaleString("en-US")} · account-wide</Badge>
            ) : null}
            <RoleManagerButton roles={roles} />
          </div>
        }
      />
      {characters.length === 0 && archived.length === 0 ? (
        <EmptyState title="No characters yet" icon={<Users className="h-8 w-8" />}>
          Install the addon, log a character out or <code className="rounded bg-surface-2 px-1">/reloadui</code>, then
          import. Or run <code className="rounded bg-surface-2 px-1">npm run seed</code> to preview.
        </EmptyState>
      ) : (
        <CharacterRoster
          characters={characters}
          archived={archived}
          roles={roles}
          assignments={assignments}
        />
      )}
    </PageFrame>
  );
}
