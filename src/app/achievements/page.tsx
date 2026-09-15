import { Trophy } from "lucide-react";
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
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Challenges done" value={`${earned}/${uniqueIds.length}`} />
            <Stat label="Trifectas" value={`${trifectas}/${triIds.length}`} />
            <Stat label="Trials" value={trials.length} />
            <Stat label="Dungeons" value={triDungeons.length} />
          </div>
          <p className="mb-4 text-xs text-fg-subtle">
            {isSample
              ? "Showing sample data (demo). Log in with the Snapshot addon to replace this with your real, game-verified completion."
              : "Completion is read directly from your game (the same IsAchievementComplete the in-game tracker uses) — nothing is inferred. ESO achievements are account-wide."}
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
