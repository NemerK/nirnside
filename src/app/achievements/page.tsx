import { RefreshCw, Trophy } from "lucide-react";
import { getCompletedAchievementIds, getDataSource, hasData } from "@/lib/db/queries";
import { PageHeader, Stat, EmptyState } from "@/components/ui";
import { SourceBadge } from "@/components/source-badge";
import { AchievementsBoard } from "@/components/achievements-board";
import { PITHKA_TABS, allTrackedIds } from "@/lib/achievements/pithka";

export const dynamic = "force-dynamic";

export default function AchievementsPage() {
  const completed = safe(() => getCompletedAchievementIds()) ?? [];
  const populated = safe(() => hasData()) ?? false;
  const source = safe(() => getDataSource());
  const isSample = source?.kind === "sample";

  const done = new Set(completed);
  const trials = PITHKA_TABS.find((t) => t.id === "Trials")!.rows;
  const triDungeons = PITHKA_TABS.find((t) => t.id === "Trifecta Dungeons")!.rows;

  const triIds = [...trials, ...triDungeons]
    .map((r) => r.tri)
    .filter((v): v is number => typeof v === "number");
  const trifectas = triIds.filter((id) => done.has(id)).length;

  const allIds = PITHKA_TABS.flatMap((t) => allTrackedIds(t.rows));
  const uniqueIds = Array.from(new Set(allIds));
  const earned = uniqueIds.filter((id) => done.has(id)).length;

  // Account exists, but this board's data (completed achievement ids) is missing
  // — the snapshot was written by an older addon. Tell the user how to fix it
  // rather than showing an all-empty board.
  const staleAddon = populated && !isSample && completed.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Trial & Dungeon Achievements"
        subtitle="The Pithka tracker, out of game: every trial, dungeon and arena challenge — done or not done."
        action={<SourceBadge source={populated && !isSample ? "ingame" : "reference"} />}
      />

      {!populated ? (
        <EmptyState title="No account data yet" icon={<Trophy className="h-8 w-8" />}>
          Log out or <code className="rounded bg-surface-2 px-1">/reloadui</code> in ESO with the Nirnside Snapshot
          addon enabled — your completed achievements are read straight from the game and light up the board. To
          preview with sample data, load the demo from the home page.
        </EmptyState>
      ) : staleAddon ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-500 dark:text-amber-400">
            <RefreshCw className="h-5 w-5" />
          </span>
          <div className="text-sm text-fg-muted">
            <p className="font-medium text-fg">One quick refresh needed to fill this board.</p>
            <p className="mt-1 max-w-3xl">
              Your account is loaded, but this snapshot came from an older version of the Snapshot addon that didn&apos;t
              yet export completed-achievement data. The current app already installed the updated addon for you — just{" "}
              <code className="rounded bg-surface-2 px-1 text-fg">/reloadui</code> (or log out) in ESO once, and this
              board fills in with your real completions automatically. No re-download needed.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Challenges done" value={`${earned}/${uniqueIds.length}`} />
            <Stat label="Trifectas" value={`${trifectas}/${triIds.length}`} />
            <Stat label="Trials" value={trials.length} />
            <Stat label="Dungeons" value={triDungeons.length} />
          </div>
          <p className="mb-3 text-xs text-fg-subtle">
            {isSample
              ? "Showing sample data (demo). Log in with the Snapshot addon to replace this with your real, game-verified completion."
              : "A check means done. If any of your characters earned it — including Maelstrom Arena — it stays checked for the whole account. Logging an alt will not uncheck it."}
          </p>
          <AchievementsBoard completedIds={completed} />
        </>
      )}
    </div>
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
