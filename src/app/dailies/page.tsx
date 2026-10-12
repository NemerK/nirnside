import { CalendarDays, RefreshCw } from "lucide-react";
import { getAccount, getCharactersFull, getDataSource, hasData } from "@/lib/db/queries";
import { liveCharacters } from "@/lib/snapshot/roster";
import { dailiesHaveAnyScan, presentAccountDailies, summarizeDailies } from "@/lib/dailies/present";
import { dailyResetHourUtc, nextEsoResetAt, type EsoRegion } from "@/lib/dailies/day";
import { communityPledgesForUnix } from "@/lib/dailies/pledges";
import { PageFrame, EmptyState } from "@/components/ui";
import { SourceBadge } from "@/components/source-badge";
import { DailiesBoard } from "@/components/dailies-board";

export const dynamic = "force-dynamic";

export default function DailiesPage() {
  const populated = safe(() => hasData()) ?? false;
  const source = safe(() => getDataSource());
  const isSample = source?.kind === "sample";
  const characters = liveCharacters(safe(() => getCharactersFull()) ?? []);
  const region: EsoRegion = safe(() => getAccount()?.region) === "NA" ? "NA" : "EU";
  const now = Math.floor(Date.now() / 1000);
  const todayPledges = communityPledgesForUnix(now, region);
  const rows = presentAccountDailies(characters, now, { treatAsFresh: isSample, todayPledges, region });
  const summary = summarizeDailies(rows);
  const resetAt = nextEsoResetAt(now, region);
  const staleAddon = populated && !isSample && characters.some((c) => c.lastSeen != null) && !dailiesHaveAnyScan(characters);

  return (
    <PageFrame>
      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1">
        <h1 className="text-lg font-semibold tracking-tight text-fg">Dailies</h1>
        {populated && !staleAddon && (
          <div className="flex flex-wrap items-center gap-x-3 text-xs text-fg-muted">
            <span>
              <span className="tabular-nums text-fg">
                {summary.scanned}/{summary.total}
              </span>{" "}
              scanned
            </span>
            <span>
              <span className="tabular-nums text-fg">
                {summary.randomsTotal ? `${summary.randomsDone}/${summary.randomsTotal}` : "—"}
              </span>{" "}
              randoms
            </span>
            <span>
              <span className="tabular-nums text-fg">
                {summary.writsTotal ? `${summary.writsDone}/${summary.writsTotal}` : "—"}
              </span>{" "}
              writs
            </span>
            <span>
              <span className="tabular-nums text-fg">
                {summary.pledgesTotal ? `${summary.pledgesDone}/${summary.pledgesTotal}` : "—"}
              </span>{" "}
              pledges
            </span>
            <span>
              <span className="tabular-nums text-fg">
                {summary.zoneDailiesTotal ? `${summary.zoneDailiesDone}/${summary.zoneDailiesTotal}` : "—"}
              </span>{" "}
              zones
            </span>
          </div>
        )}
        <div className="ml-auto">
          <SourceBadge source={populated && !isSample ? "ingame" : "reference"} />
        </div>
      </div>

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
              dailies. The current app already installed 0.9.27 for you — log each character out once (or{" "}
              <code className="rounded bg-surface-2 px-1 text-fg">/reloadui</code> on that toon) and the row
              fills with live journal and LFG state.
            </p>
          </div>
        </div>
      ) : (
        <DailiesBoard
          rows={rows}
          resetAt={resetAt}
          todayPledges={todayPledges}
          resetLabel={`${region} ${String(dailyResetHourUtc(region)).padStart(2, "0")}:00 UTC`}
        />
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
