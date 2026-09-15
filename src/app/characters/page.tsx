import { Users } from "lucide-react";
import { getCharacters } from "@/lib/db/queries";
import { CharacterCard } from "@/components/character-card";
import { Badge, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function CharactersPage() {
  let characters: ReturnType<typeof getCharacters> = [];
  try {
    characters = getCharacters();
  } catch {
    characters = [];
  }

  const accountCP = characters.reduce((m, c) => Math.max(m, c.championPoints ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Characters"
        subtitle="Every character on the account. Empty ones fill in the first time you log them out."
        action={
          accountCP > 0 ? (
            <Badge tone="accent">CP {accountCP.toLocaleString("en-US")} · account-wide</Badge>
          ) : undefined
        }
      />
      {characters.length === 0 ? (
        <EmptyState title="No characters yet" icon={<Users className="h-8 w-8" />}>
          Install the addon, log a character out or <code className="rounded bg-surface-2 px-1">/reloadui</code>, then
          import. Or run <code className="rounded bg-surface-2 px-1">npm run seed</code> to preview.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((c) => (
            <CharacterCard key={c.id} character={c} />
          ))}
        </div>
      )}
    </div>
  );
}
