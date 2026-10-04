import { Shirt, RefreshCw } from "lucide-react";
import { getAccount, getCharactersFull, getDataSource, getOutfitStyles, hasData } from "@/lib/db/queries";
import { liveCharacters } from "@/lib/snapshot/roster";
import { accountHasOutfitStylesScan, knownMotifKeys, presentOutfitStyles } from "@/lib/knowledge/present";
import { OutfitStylesGrid } from "@/components/outfit-styles-grid";
import { EmptyState, PageFrame, PageHeader, Stat } from "@/components/ui";
import { SourceBadge } from "@/components/source-badge";

export const dynamic = "force-dynamic";

export default async function StylesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const initialQuery = typeof sp.q === "string" ? sp.q : undefined;

  const populated = safe(() => hasData()) ?? false;
  const source = safe(() => getDataSource());
  const isSample = source?.kind === "sample";
  const account = safe(() => getAccount());
  const categories = safe(() => getOutfitStyles()) ?? [];
  const characters = liveCharacters(safe(() => getCharactersFull()) ?? []);
  const presented = presentOutfitStyles(categories);
  const staleAddon =
    populated &&
    !isSample &&
    Boolean(account?.lastSnapshot) &&
    !accountHasOutfitStylesScan(categories);

  const motifKeys = new Set<string>();
  for (const c of characters) {
    for (const key of knownMotifKeys(c.motifs)) motifKeys.add(key);
  }

  return (
    <PageFrame>
      <PageHeader
        title="Outfit Styles"
        subtitle="Collections → Outfit Styles, as the game trees them. Account-wide cosmetics — not motif craft knowledge, not the stickerbook, and not an outfit editor."
        action={<SourceBadge source={populated && !isSample ? "ingame" : "reference"} />}
      />

      {!populated ? (
        <EmptyState title="No account data yet" icon={<Shirt className="h-8 w-8" />}>
          Log out or <code className="rounded bg-surface-2 px-1">/reloadui</code> in ESO with the Nirnside Snapshot
          addon enabled. Outfit Styles come from the collectible book.
        </EmptyState>
      ) : staleAddon ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-500 dark:text-amber-400">
            <RefreshCw className="h-5 w-5" />
          </span>
          <div className="text-sm text-fg-muted">
            <p className="font-medium text-fg">One logout needed to list Outfit Styles.</p>
            <p className="mt-1 max-w-3xl">
              Your account is loaded, but this snapshot came from an older addon that did not export Collections
              → Outfit Styles. Log out or <code className="rounded bg-surface-2 px-1 text-fg">/reloadui</code>{" "}
              once and this page fills from the in-game collectible book.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat
              label="Unlocked"
              value={presented.total ? `${pct(presented.unlocked, presented.total)}%` : "—"}
              hint={presented.total ? `${presented.unlocked}/${presented.total} styles` : "none listed"}
            />
            <Stat label="Categories" value={presented.categories.length} hint="as the game lists them" />
            <Stat label="Still locked" value={Math.max(0, presented.total - presented.unlocked)} />
          </div>
          <OutfitStylesGrid presented={presented} motifKeys={[...motifKeys]} initialQuery={initialQuery} />
        </>
      )}
    </PageFrame>
  );
}

function pct(known: number, total: number): number {
  return total ? Math.round((known / total) * 100) : 0;
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
