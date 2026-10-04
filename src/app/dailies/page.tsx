import { CalendarDays, RefreshCw } from "lucide-react";
import { getCharactersFull, getDataSource, hasData } from "@/lib/db/queries";
import { liveCharacters } from "@/lib/snapshot/roster";
import { dailiesHaveAnyScan, presentAccountDailies, summarizeDailies } from "@/lib/dailies/present";
import { nextEsoResetAt } from "@/lib/dailies/day";
import { communityPledgesForUnix } from "@/lib/dailies/pledges";
import { PageFrame, PageHeader, Stat, EmptyState } from "@/components/ui";
import { SourceBadge } from "@/components/source-badge";
import { DailiesBoard } from "@/components/dailies-board";

export const dynamic = "force-dynamic";

export default function DailiesPage() {
  const populated = safe(() => hasData()) ?? false;
  const source = safe(() => getDataSource());
  const isSample = source?.kind === "sample";
  const characters = liveCharacters(safe(() => getCharactersFull()) ?? []);
  const now = Math.floor(Date.now() / 1000);
  const rows = presentAccountDailies(characters, now, { treatAsFresh: isSample });
  const summary = summarizeDailies(rows);
  const resetAt = nextEsoResetAt(now);
  const todayPledges = communityPledgesForUnix(now);
  const staleAddon = populated && !isSample && characters.some((c) => c.lastSeen != null) && !dailiesHaveAnyScan(characters);

  return (
    <PageFrame>
      <PageHeader
        title="Dailies"
        subtitle="Randoms, writs, and pledges. Pledge marks are HM or nHM when we know the mode."
        action={<SourceBadge source={populated && !isSample ? "ingame" : "reference"} />}
      />

      {!populated ? (
        <EmptyState title="No account data yet" icon={<CalendarDays className="h-8 w-8" />}>
          Log out or <code className="rounded bg-surface-2 px-1">/reloadui</code> in ESO with the Nirnside Snapshot
          addon enabled. Random dungeon rewards, writs, and pledges are read from the game at logout — never
          guessed. To preview with sample data, load the demo from the home page.
        </EmptyState>
      ) : staleAddon ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-500 dark:text-amber-400">
            <RefreshCw className="h-5 w-5" />
          </span>
          <div className="text-sm text-fg-muted">
            <p className="font-medium text-fg">One logout needed to fill this board.</p>
            <p className="mt-1 max-w-3xl">
              Your account is loaded, but this snapshot came from an older Snapshot addon that did not export
              dailies. The current app already installed 0.9.22 for you — log each character out once (or{" "}
              <code className="rounded bg-surface-2 px-1 text-fg">/reloadui</code> on that toon) and the row
              fills with live journal and LFG state.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Scanned today" value={`${summary.scanned}/${summary.total}`} />
            <Stat
              label="Randoms"
              value={summary.randomsTotal ? `${summary.randomsDone}/${summary.randomsTotal}` : "—"}
            />
            <Stat label="Writs" value={summary.writsTotal ? `${summary.writsDone}/${summary.writsTotal}` : "—"} />
            <Stat
              label="Pledges"
              value={summary.pledgesTotal ? `${summary.pledgesDone}/${summary.pledgesTotal}` : "—"}
            />
          </div>
          <DailiesBoard rows={rows} resetAt={resetAt} todayPledges={todayPledges} />
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
