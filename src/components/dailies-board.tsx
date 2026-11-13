"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { PageScroll, StickyMenu } from "@/components/ui";
import { formatRemainingSeconds } from "@/lib/dailies/day";
import {
  WRIT_ABBR,
  WRIT_CRAFTS,
  WRIT_LABELS,
  type DailyCell,
  type PresentedCharacterDailies,
} from "@/lib/dailies/present";
import { PLEDGE_GIVER_NAMES, type PledgeGiver } from "@/lib/dailies/pledges";
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

function ResetCountdown({ resetAt, label }: { resetAt: number; label?: string }) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);
  const remaining = Math.max(0, resetAt - now);
  return (
    <div className="text-sm text-fg-muted">
      Time until reset{" "}
      <span className="font-mono tabular-nums text-fg">{formatRemainingSeconds(remaining)}</span>
      {label ? <span className="ml-1 text-xs text-fg-subtle">({label})</span> : null}
    </div>
  );
}

function PledgeHead({ giver, today }: { giver: PledgeGiver; today?: string }) {
  return (
    <th className="px-1.5 py-1 text-center font-medium" title={PLEDGE_GIVER_NAMES[giver]}>
      {giver === "maj" ? "Maj" : giver === "glirion" ? "Gli" : "Urg"}
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
                <th className="sticky left-0 z-10 bg-surface-2 px-2 py-1 font-medium">Character</th>
                <th className="px-1.5 py-1 text-center font-medium" title="Random Normal daily reward">
                  RN
                </th>
                <th className="px-1.5 py-1 text-center font-medium" title="Random Veteran daily reward">
                  RV
                </th>
                {WRIT_CRAFTS.map((c) => (
                  <th key={c} className="px-1.5 py-1 text-center font-medium" title={`${WRIT_LABELS[c]} writ`}>
                    {WRIT_ABBR[c]}
                  </th>
                ))}
                <PledgeHead giver="maj" today={todayPledges.maj} />
                <PledgeHead giver="glirion" today={todayPledges.glirion} />
                <PledgeHead giver="urgarlag" today={todayPledges.urgarlag} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-fg-subtle">
          Empty box = no quest. A mark in the box = the right quest is picked up and not finished.
          Check = done for the day. These reset with the daily reset. Zone dailies are on Zones.
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
