/**
 * One short HUD row for the achievements board.
 * Segmented like an in-game progress bar, short enough that the list stays the page.
 */

export interface AchievementStripItem {
  label: string;
  done: number;
  total: number;
}

export function AchievementsStrip({ items }: { items: AchievementStripItem[] }) {
  return (
    <div className="mb-2 flex overflow-hidden rounded-lg border border-border bg-surface">
      {items.map((item, index) => {
        const pct = item.total > 0 ? Math.min(100, Math.round((item.done / item.total) * 100)) : 0;
        return (
          <div
            key={item.label}
            className={`min-w-0 flex-1 px-3 py-1.5 ${index > 0 ? "border-l border-border" : ""}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[10px] font-medium uppercase tracking-wide text-fg-subtle">
                {item.label}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-fg">
                {item.total > 0 ? (
                  <>
                    {item.done}
                    <span className="font-normal text-fg-subtle">/{item.total}</span>
                  </>
                ) : (
                  <span className="font-normal text-fg-subtle">—</span>
                )}
              </span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div className="h-full rounded-full bg-ok" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
