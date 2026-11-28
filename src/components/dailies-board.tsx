"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { SortHeader, useSort } from "@/components/sort-header";
import { PageScroll, StickyMenu } from "@/components/ui";
import { formatRemainingSeconds } from "@/lib/game/daily-reset";
import {
  WRIT_ABBR,
  type DailyCell,
  type PresentedCharacterDailies,
} from "@/lib/dailies/present";
import { WRIT_CRAFTS, WRIT_LABELS, type WritCraft } from "@/lib/game/writs";
import { PLEDGE_GIVER_NAMES, type PledgeGiver } from "@/lib/game/pledges";
import { sortRows, statusRank } from "@/lib/ui/column-sort";
import type { SortState } from "@/lib/ui/column-sort";
import { ZoneDailiesBoard } from "@/components/zone-dailies-board";

type Filter = "all" | "open" | "done";
type BoardTab = "today" | "zones";

function rowOpen(row: PresentedCharacterDailies): boolean {
  const cells = [
    row.randomNormal,
    row.randomVeteran,
    ...WRIT_CRAFTS.map((c) => row.writs[c]),
    row.pledges.maj,
    row.pledges.glirion,
    row.pledges.urgarlag,
    row.riding,
  ];
  return cells.some((c) => c.status === "available" || c.status === "accepted" || c.status === "ready");
}

function zoneRowOpen(row: PresentedCharacterDailies): boolean {
  return Object.values(row.zoneSlots).some((slot) => slot.status !== "done");
}

function DailyCellView({ cell }: { cell: DailyCell }) {
  const done = cell.status === "done" || cell.status === "cooldown";
  const held = cell.status === "accepted" || cell.status === "ready";
  return (
    <span
      title={cell.title}
      className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
        done
          ? "border-ok/50 bg-ok/15 text-ok"
          : held
            ? "border-amber-500/70 bg-amber-500/10"
            : "border-border bg-transparent"
      }`}
    >
      {done ? <Check className="h-3 w-3" /> : null}
      {held ? <span className="h-1.5 w-1.5 rounded-[2px] bg-amber-500" /> : null}
    </span>
  );
}

/**
 * The riding lesson: its own timer, not the reset. An empty box is a lesson
 * waiting; a check is taken, with the hours until the next one beside it.
 */
function RidingCellView({ cell }: { cell: DailyCell }) {
  const hours = cell.status === "cooldown" && cell.remainingSeconds != null ? Math.ceil(cell.remainingSeconds / 3600) : null;
  return (
    <span className="inline-flex items-center gap-1" title={cell.title}>
      <DailyCellView cell={cell} />
      {hours != null ? <span className="text-[10px] tabular-nums text-fg-subtle">{hours}h</span> : null}
    </span>
  );
}

function ResetCountdown({ resetAt, label }: { resetAt: number; label?: string }) {
  // Date.now() during the first render disagrees between the server HTML and
  // the browser, which fails hydration. Stay blank until the client ticks.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Math.floor(Date.now() / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  const text = now == null ? "\u2013:\u2013\u2013" : formatRemainingSeconds(Math.max(0, resetAt - now));
  return (
    <div className="text-sm text-fg-muted">
      Time until reset{" "}
      <span className="font-mono tabular-nums text-fg">{text}</span>
      {label ? <span className="ml-1 text-xs text-fg-subtle">({label})</span> : null}
    </div>
  );
}

function todayValue(row: PresentedCharacterDailies, key: string): string | number | null {
  if (key === "name") return row.name;
  if (key === "rn") return statusRank(row.randomNormal.status);
  if (key === "rv") return statusRank(row.randomVeteran.status);
  if (key.startsWith("writ:")) return statusRank(row.writs[key.slice(5) as WritCraft]?.status);
  if (key.startsWith("pledge:")) return statusRank(row.pledges[key.slice(7) as PledgeGiver]?.status);
  if (key === "riding") return statusRank(row.riding.status);
  return null;
}

function PledgeHead({
  giver,
  today,
  sort,
  onSort,
}: {
  giver: PledgeGiver;
  today?: string;
  sort: SortState<string>;
  onSort: (column: string) => void;
}) {
  const label = giver === "maj" ? "Maj" : giver === "glirion" ? "Gli" : "Urg";
  return (
    <th className="px-1.5 py-1 text-center font-medium">
      <SortHeader
        label={label}
        column={`pledge:${giver}`}
        sort={sort}
        onSort={onSort}
        align="center"
        title={`${PLEDGE_GIVER_NAMES[giver]} — sort by status`}
      />
      {today ? (
        <div className="mt-0.5 max-w-[7.5rem] truncate text-[10px] font-normal normal-case tracking-normal text-fg-muted">
          {today}
        </div>
      ) : null}
    </th>
  );
}

export function DailiesBoard({
  rows,
  resetAt,
  todayPledges,
  resetLabel,
}: {
  rows: PresentedCharacterDailies[];
  resetAt: number;
  todayPledges: Record<PledgeGiver, string>;
  resetLabel?: string;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [tab, setTab] = useState<BoardTab>("today");
  const panelRef = useRef<HTMLDivElement>(null);

  function selectTab(next: BoardTab) {
    setTab(next);
    panelRef.current?.scrollTo({ top: 0, left: 0 });
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.className.toLowerCase().includes(q)) return false;
      const open = tab === "zones" ? zoneRowOpen(r) : rowOpen(r);
      if (filter === "open" && !open) return false;
      if (filter === "done" && open) return false;
      return true;
    });
  }, [rows, search, filter, tab]);

  const { sort, onSort } = useSort<string>();
  const sorted = useMemo(() => sortRows(filtered, sort, todayValue), [filtered, sort]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <StickyMenu>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5" role="tablist">
            {(
              [
                ["today", "Today"],
                ["zones", "Zones"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  // The page scroller can swallow the click that follows this
                  // press, so enter the tab on the press itself.
                  event.preventDefault();
                  selectTab(id);
                }}
                onClick={() => selectTab(id)}
                className={`rounded-md px-2.5 py-1 text-sm transition-colors ${
                  tab === id ? "bg-accent font-medium text-accent-fg" : "text-fg-muted hover:text-fg"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[10rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search characters…"
              className="w-full rounded-lg border border-border bg-surface py-1 pl-8 pr-2 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
            />
          </div>
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
            {(
              [
                ["all", "All"],
                ["open", "Still open"],
                ["done", "Finished"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded-md px-2 py-1 text-sm transition-colors ${
                  filter === k ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <ResetCountdown resetAt={resetAt} label={resetLabel} />
        </div>
      </StickyMenu>

      <PageScroll ref={panelRef}>
        {tab === "zones" ? (
          <ZoneDailiesBoard rows={filtered} accountRows={rows} />
        ) : (
        <>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/40 text-left text-[11px] uppercase tracking-wider text-fg-subtle">
                <th className="sticky left-0 z-10 bg-surface-2 px-2 py-1 font-medium">
                  <SortHeader label="Character" column="name" sort={sort} onSort={onSort} />
                </th>
                <th className="px-1.5 py-1 text-center font-medium">
                  <SortHeader label="RN" column="rn" sort={sort} onSort={onSort} align="center" title="Random Normal daily reward" />
                </th>
                <th className="px-1.5 py-1 text-center font-medium">
                  <SortHeader label="RV" column="rv" sort={sort} onSort={onSort} align="center" title="Random Veteran daily reward" />
                </th>
                {WRIT_CRAFTS.map((c) => (
                  <th key={c} className="px-1.5 py-1 text-center font-medium">
                    <SortHeader
                      label={WRIT_ABBR[c]}
                      column={`writ:${c}`}
                      sort={sort}
                      onSort={onSort}
                      align="center"
                      title={`${WRIT_LABELS[c]} writ`}
                    />
                  </th>
                ))}
                <PledgeHead giver="maj" today={todayPledges.maj} sort={sort} onSort={onSort} />
                <PledgeHead giver="glirion" today={todayPledges.glirion} sort={sort} onSort={onSort} />
                <PledgeHead giver="urgarlag" today={todayPledges.urgarlag} sort={sort} onSort={onSort} />
                <th className="px-1.5 py-1 text-center font-medium">
                  <SortHeader label="Ride" column="riding" sort={sort} onSort={onSort} align="center" title="Riding lesson, on its own timer" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.characterId} className="group border-b border-border/50 align-middle last:border-0">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-2 py-0.5 group-hover:bg-surface-2">
                    <a href={`/characters/${encodeURIComponent(r.characterId)}`} className="text-sm font-medium text-fg hover:text-accent">
                      {r.name}
                    </a>
                    <span className="ml-1.5 text-[11px] text-fg-subtle">{r.className}</span>
                  </td>
                  <td className="px-1.5 py-0.5 text-center">
                    <DailyCellView cell={r.randomNormal} />
                  </td>
                  <td className="px-1.5 py-0.5 text-center">
                    <DailyCellView cell={r.randomVeteran} />
                  </td>
                  {WRIT_CRAFTS.map((c) => (
                    <td key={c} className="px-1.5 py-0.5 text-center">
                      <DailyCellView cell={r.writs[c]} />
                    </td>
                  ))}
                  <td className="px-1.5 py-0.5 text-center">
                    <DailyCellView cell={r.pledges.maj} />
                  </td>
                  <td className="px-1.5 py-0.5 text-center">
                    <DailyCellView cell={r.pledges.glirion} />
                  </td>
                  <td className="px-1.5 py-0.5 text-center">
                    <DailyCellView cell={r.pledges.urgarlag} />
                  </td>
                  <td className="px-1.5 py-0.5 text-left">
                    <RidingCellView cell={r.riding} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-fg-subtle">
          Empty box = no quest. A mark in the box = the right quest is picked up and not finished.
          Check = done for the day. These reset with the daily reset, except the riding lesson, which runs on
          each character&apos;s own timer (hours to the next lesson beside it). Zone dailies are on Zones.
        </p>
        </>
        )}

        {filtered.length === 0 && (
          <div className="mt-3 rounded-xl border border-border bg-surface/70 px-6 py-10 text-center text-sm text-fg-muted">
            Nothing matches these filters.
          </div>
        )}
      </PageScroll>
    </div>
  );
}
