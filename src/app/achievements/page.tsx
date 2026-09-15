import { Trophy } from "lucide-react";
import { getAchievements } from "@/lib/db/catalog-queries";
import { getAchievementRecords, hasAchievementRecords, getEarnedAchievements } from "@/lib/db/queries";
import { getCatalogMeta } from "@/lib/catalog/import";
import { PageHeader, Stat, EmptyState } from "@/components/ui";
import { SourceBadge } from "@/components/source-badge";
import { AchievementsBoard } from "@/components/achievements-board";
import { classifyAchievement, normalizeCategory } from "@/lib/achievements/classify";
import { buildRows, boardStats, type BoardItem } from "@/lib/achievements/board";
import type { CatalogSource } from "@/lib/catalog/schema";

export const dynamic = "force-dynamic";

export default function AchievementsPage() {
  const inGame = safe(() => hasAchievementRecords()) ?? false;
  const { items, source } = inGame ? fromGame() : fromReference();

  const rows = buildRows(items);
  const stats = boardStats(rows);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Trial & Dungeon Achievements"
        subtitle="Pithka-style completion board across trials, arenas and dungeons. Achievements are account-wide."
        action={<SourceBadge source={source} />}
      />

      {rows.length === 0 ? (
        <EmptyState title="No achievements yet" icon={<Trophy className="h-8 w-8" />}>
          Log out or <code className="rounded bg-surface-2 px-1">/reloadui</code> in ESO with the Nirnside Snapshot
          addon enabled — your trial, dungeon and arena achievements are read straight from the game and appear here.
          To preview with sample data, load the demo from the home page.
        </EmptyState>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat
              label="Achievements"
              value={`${stats.earned}/${stats.total}`}
              hint={`${stats.total ? Math.round((stats.earned / stats.total) * 100) : 0}% earned`}
            />
            <Stat label="Trifectas" value={`${stats.trifectas.earned}/${stats.trifectas.total}`} />
            <Stat label="Titles" value={`${stats.titles.earned}/${stats.titles.total}`} />
            <Stat
              label="Points"
              value={`${stats.points.earned.toLocaleString()}`}
              hint={`of ${stats.points.total.toLocaleString()}`}
            />
            <Stat label="Content tracked" value={stats.contentTracked} />
          </div>
          <p className="mb-4 text-xs text-fg-subtle">
            {inGame
              ? "Completion, points and names are read directly from your game — nothing is inferred. ESO exposes achievements at the account level, not per character, so Nirnside shows account-wide completion."
              : "Showing reference content (demo). Log in with the Snapshot addon to replace this with your real, game-verified completion."}
          </p>
          <AchievementsBoard rows={rows} />
        </>
      )}
    </div>
  );
}

/** Build board items from real, game-exported achievement records. */
function fromGame(): { items: BoardItem[]; source: CatalogSource } {
  const records = safe(() => getAchievementRecords()) ?? [];
  const items: BoardItem[] = records.map((r) => ({
    content: r.content || normalizeCategory(r.category),
    category: normalizeCategory(r.category),
    column: classifyAchievement(r),
    name: r.name,
    completed: r.completed,
    points: r.points,
    title: r.title,
  }));
  return { items, source: "ingame" };
}

/**
 * Fallback for demo/empty state: derive from the reference catalog, using the
 * curated subtype for the column and matching earned status by name. This is the
 * old (less accurate) path, only used when no game data is present.
 */
function fromReference(): { items: BoardItem[]; source: CatalogSource } {
  const earned = safe(() => getEarnedAchievements()) ?? new Set<string>();
  const list = safe(() => getAchievements()) ?? [];
  const meta = safe(() => getCatalogMeta());
  const items: BoardItem[] = list.map(({ entry }) => ({
    content: entry.content,
    category: normalizeCategory(entry.category),
    column: entry.subtype,
    name: entry.name,
    completed: earned.has(entry.name.toLowerCase()),
    points: 0,
    title: null,
  }));
  return { items, source: (meta?.source as CatalogSource) ?? "reference" };
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
