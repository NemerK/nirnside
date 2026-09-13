import { Trophy } from "lucide-react";
import { getAchievements } from "@/lib/db/catalog-queries";
import { getEarnedAchievements } from "@/lib/db/queries";
import { getCatalogMeta } from "@/lib/catalog/import";
import { PageHeader, Stat, EmptyState } from "@/components/ui";
import { SourceBadge } from "@/components/source-badge";
import { AchievementsBoard, type ContentRow } from "@/components/achievements-board";
import type { CatalogSource } from "@/lib/catalog/schema";

export const dynamic = "force-dynamic";

const CONTENT_ORDER = ["Trial", "Arena", "Dungeon"];

export default function AchievementsPage() {
  const meta = safe(() => getCatalogMeta());
  const earned = safe(() => getEarnedAchievements()) ?? new Set<string>();
  const list = safe(() => getAchievements()) ?? [];

  const byContent = new Map<string, ContentRow>();
  for (const { entry, source } of list) {
    if (!byContent.has(entry.content)) {
      byContent.set(entry.content, { content: entry.content, category: entry.category, source, cells: {} });
    }
    const row = byContent.get(entry.content)!;
    const col = entry.subtype === "Speed" || entry.subtype === "No Death" ? "Trifecta" : entry.subtype;
    if (col === "Completion" || col === "Hard Mode" || col === "Trifecta") {
      row.cells[col] = { name: entry.name, earned: earned.has(entry.name.toLowerCase()) };
    }
  }

  const rows = Array.from(byContent.values()).sort((a, b) => {
    const ca = CONTENT_ORDER.indexOf(a.category);
    const cb = CONTENT_ORDER.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return a.content.localeCompare(b.content);
  });

  const totalAch = list.length;
  const earnedAch = list.filter((a) => earned.has(a.entry.name.toLowerCase())).length;
  const trifectas = list.filter((a) => a.entry.subtype === "Trifecta");
  const trifectasEarned = trifectas.filter((a) => earned.has(a.entry.name.toLowerCase())).length;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Trial & Dungeon Achievements"
        subtitle="Pithka-style completion board across trials, arenas and dungeons. Achievements are account-wide."
        action={meta ? <SourceBadge source={meta.source as CatalogSource} /> : undefined}
      />

      {rows.length === 0 ? (
        <EmptyState title="No achievement catalog yet" icon={<Trophy className="h-8 w-8" />}>
          The trial/dungeon board loads from the catalog. Run <code className="rounded bg-surface-2 px-1">npm run seed</code>.
        </EmptyState>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat
              label="Achievements"
              value={`${earnedAch}/${totalAch}`}
              hint={`${totalAch ? Math.round((earnedAch / totalAch) * 100) : 0}% earned`}
            />
            <Stat label="Trifectas" value={`${trifectasEarned}/${trifectas.length}`} />
            <Stat label="Content tracked" value={rows.length} />
            <Stat label="Source" value={meta?.source === "ingame" ? "In-game" : "Reference"} />
          </div>
          <p className="mb-4 text-xs text-fg-subtle">
            ESO exposes achievements at the account level, not per character, so Nirnside shows account-wide completion
            and does not fabricate which character earned each one.
          </p>
          <AchievementsBoard rows={rows} />
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
