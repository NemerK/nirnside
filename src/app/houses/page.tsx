import { Landmark, RefreshCw, Star } from "lucide-react";
import { getCharactersFull, getDataSource, getHouses, hasData } from "@/lib/db/queries";
import { liveCharacters } from "@/lib/snapshot/roster";
import { dailiesHaveAnyScan } from "@/lib/dailies/present";
import { Card, PageFrame, PageHeader, PageScroll, Stat, EmptyState } from "@/components/ui";
import { SourceBadge } from "@/components/source-badge";
import { GameIcon } from "@/components/game-icon";

export const dynamic = "force-dynamic";

export default function HousesPage() {
  const populated = safe(() => hasData()) ?? false;
  const source = safe(() => getDataSource());
  const isSample = source?.kind === "sample";
  const houses = safe(() => getHouses()) ?? [];
  const characters = liveCharacters(safe(() => getCharactersFull()) ?? []);
  const staleAddon =
    populated && !isSample && houses.length === 0 && characters.some((c) => c.lastSeen != null) && !dailiesHaveAnyScan(characters);

  const sorted = [...houses].sort((a, b) => {
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const primary = sorted.find((h) => h.primary);

  return (
    <PageFrame>
      <PageHeader
        title="Houses"
        subtitle="Every house this account has unlocked. Ownership only — house banks are not collected."
        action={<SourceBadge source={populated && !isSample ? "ingame" : "reference"} />}
      />

      {!populated ? (
        <EmptyState title="No account data yet" icon={<Landmark className="h-8 w-8" />}>
          Log out or <code className="rounded bg-surface-2 px-1">/reloadui</code> in ESO with the Nirnside Snapshot
          addon enabled. Owned houses come from the collectible book. To preview with sample data, load the demo
          from the home page.
        </EmptyState>
      ) : staleAddon ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-500 dark:text-amber-400">
            <RefreshCw className="h-5 w-5" />
          </span>
          <div className="text-sm text-fg-muted">
            <p className="font-medium text-fg">One logout needed to list your houses.</p>
            <p className="mt-1 max-w-3xl">
              Your account is loaded, but this snapshot came from an older Snapshot addon that did not export
              houses. Log out or <code className="rounded bg-surface-2 px-1 text-fg">/reloadui</code> once and
              this page fills from the in-game collectible book.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Owned" value={sorted.length} />
            <Stat label="Primary" value={primary?.name ?? "—"} hint={primary?.location ?? undefined} />
          </div>
          {sorted.length === 0 ? (
            <EmptyState title="No houses unlocked" icon={<Landmark className="h-8 w-8" />}>
              The last snapshot found no unlocked house collectibles on this account.
            </EmptyState>
          ) : (
            <PageScroll>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sorted.map((h) => (
                  <li key={h.collectibleId}>
                    <Card className="flex items-start gap-3 p-3">
                      <GameIcon name={h.name} icon={h.icon ?? undefined} size={48} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="font-medium text-fg">{h.name}</h2>
                          {h.primary && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-accent/40 bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
                              <Star className="h-3 w-3" /> Primary
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm text-fg-muted">{h.location || "Location unknown"}</p>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </PageScroll>
          )}
        </>
      )}
    </PageFrame>
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
