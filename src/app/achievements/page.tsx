import { RefreshCw, Trophy } from "lucide-react";
import { getCompletedAchievementIds, getDataSource, hasData } from "@/lib/db/queries";
import { PageFrame, PageHeader, EmptyState } from "@/components/ui";
import { SourceBadge } from "@/components/source-badge";
import { AchievementsBoard } from "@/components/achievements-board";
import { AchievementsStrip } from "@/components/achievements-strip";
import { LookSwitch } from "@/components/look-switch";
import { AtlasSection } from "@/components/atlas/section";
import { presentAchievements } from "@/lib/achievements/present";
import { PITHKA_TABS } from "@/lib/achievements/pithka";

export const dynamic = "force-dynamic";

export default function AchievementsPage() {
  const completed = safe(() => getCompletedAchievementIds()) ?? [];
  const populated = safe(() => hasData()) ?? false;
  const source = safe(() => getDataSource());
  const isSample = source?.kind === "sample";
  const present = presentAchievements({ completedIds: completed });

  const done = new Set(completed);
  const trials = PITHKA_TABS.find((t) => t.id === "Trials")!.rows;
  const triDungeons = PITHKA_TABS.find((t) => t.id === "Trifecta Dungeons")!.rows;

  const triIds = [...trials, ...triDungeons]
    .map((r) => r.tri)
    .filter((v): v is number => typeof v === "number");
  const trifectas = triIds.filter((id) => done.has(id)).length;

  const staleAddon = populated && !isSample && completed.length === 0;
  const showBoard = populated && !staleAddon;

  const strip = (
    <AchievementsStrip
      items={[
        { label: "Cleared", done: present.pithka.done, total: present.pithka.total },
        { label: "Trifectas", done: trifectas, total: triIds.length },
        {
          label: "Trials",
          done: present.pithka.byTab.Trials.done,
          total: present.pithka.byTab.Trials.total,
        },
        {
          label: "Arenas",
          done: present.pithka.byTab.Arenas.done,
          total: present.pithka.byTab.Arenas.total,
        },
      ]}
    />
  );

  const board = (
    <>
      {strip}
      <p className="mb-2 shrink-0 text-xs text-fg-subtle">
        {isSample
          ? "Sample data. A logout with the Snapshot addon replaces this with your clears."
          : "A check is account-wide, including Maelstrom Arena."}
      </p>
      <AchievementsBoard completedIds={completed} />
    </>
  );

  const empty = !populated ? (
    <EmptyState title="No account data yet" icon={<Trophy className="h-8 w-8" />}>
      Log out or <code className="rounded bg-surface-2 px-1">/reloadui</code> in ESO with the Nirnside Snapshot
      addon enabled — your completed achievements are read straight from the game and light up the board. To
      preview with sample data, load the demo from the home page.
    </EmptyState>
  ) : (
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
  );

  const content = showBoard ? board : empty;
  const badge = <SourceBadge source={populated && !isSample ? "ingame" : "reference"} />;

  return (
    <LookSwitch
      classic={
        <PageFrame>
          <PageHeader
            title="Trial & Dungeon Achievements"
            subtitle="The Pithka tracker, out of game: every trial, dungeon and arena challenge — done or not done."
            action={badge}
          />
          {content}
        </PageFrame>
      }
      atlas={
        <AtlasSection grain="Account" title="Achievements" action={badge} compact>
          {content}
        </AtlasSection>
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
