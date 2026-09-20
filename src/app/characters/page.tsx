import { Archive, Users } from "lucide-react";
import { getAccount, getArchivedCharacters, getCharacters } from "@/lib/db/queries";
import { goldBreakdown } from "@/lib/snapshot/roster";
import { CharacterCard } from "@/components/character-card";
import { CurrencyTable } from "@/components/currency-table";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function CharactersPage() {
  let characters: ReturnType<typeof getCharacters> = [];
  let archived: ReturnType<typeof getArchivedCharacters> = [];
  let bankGold = 0;
  let gold = goldBreakdown({ characters: [] });
  try {
    characters = getCharacters();
    archived = getArchivedCharacters();
    const account = getAccount();
    bankGold = account?.currencies?.bankGold ?? 0;
    gold = goldBreakdown({
      characters,
      bankGold,
      legacyGold: account?.gold,
    });
  } catch {
    characters = [];
    archived = [];
  }

  const accountCP = characters.reduce((m, c) => Math.max(m, c.championPoints ?? 0), 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Characters"
        subtitle="The live ESO roster. Deleted toons are kept in Archive with their last-known snapshot."
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
        <>
          <div className="mb-8">
            <CurrencyTable characters={characters} bankGold={bankGold} gold={gold} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {characters.map((c) => (
              <CharacterCard key={c.id} character={c} />
            ))}
          </div>
        </>
      )}

      {archived.length > 0 && (
        <section id="archive" className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <Archive className="h-4 w-4 text-fg-subtle" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-fg-subtle">Archive</h2>
            <Badge tone="muted">{archived.length}</Badge>
          </div>
          <Card className="mb-4 px-4 py-3 text-sm text-fg-muted">
            These characters are gone from the live ESO roster. Their last snapshot stays here so the current roster
            stays honest — last-known bags and gold are not mixed into Inventory or the account total.
          </Card>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((c) => (
              <CharacterCard key={c.id} character={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
