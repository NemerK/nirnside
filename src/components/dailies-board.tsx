"use client";

import { useMemo, useState } from "react";
import { Check, HelpCircle, Minus, Search } from "lucide-react";
import { PageScroll, StickyMenu } from "@/components/ui";
import {
  WRIT_ABBR,
  WRIT_CRAFTS,
  WRIT_LABELS,
  type DailyCell,
  type PresentedCharacterDailies,
} from "@/lib/dailies/present";
import { PLEDGE_GIVER_NAMES } from "@/lib/dailies/pledges";

type Filter = "all" | "open" | "done";

function cellDone(c: DailyCell): boolean {
  return c.status === "done" || c.status === "cooldown";
}

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

function DailyCellView({ cell }: { cell: DailyCell }) {
  if (cell.status === "done") {
    return (
      <span
        title={cell.title}
        className="inline-flex h-5 w-5 items-center justify-center rounded border border-ok/40 bg-ok/10 text-ok"
      >
        <Check className="h-3 w-3" />
      </span>
    );
  }
  if (cell.status === "accepted" || cell.status === "ready") {
    return (
      <span
        title={cell.title}
        className={`inline-flex items-center rounded border px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          cell.status === "ready"
            ? "border-accent/50 bg-accent-soft text-accent"
            : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        }`}
      >
        {cell.label}
      </span>
    );
  }
  if (cell.status === "cooldown") {
    return (
      <span title={cell.title} className="font-mono text-xs tabular-nums text-fg-muted">
        {cell.label}
      </span>
    );
  }
  if (cell.status === "unknown") {
    return (
      <span title={cell.title} className="inline-flex text-fg-subtle/70">
        <HelpCircle className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span title={cell.title} className="inline-flex h-5 w-5 items-center justify-center text-fg-subtle/40">
      <Minus className="h-3 w-3" />
    </span>
  );
}

export function DailiesBoard({ rows }: { rows: PresentedCharacterDailies[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.className.toLowerCase().includes(q)) return false;
      if (filter === "open" && !rowOpen(r)) return false;
      if (filter === "done" && rowOpen(r)) return false;
      return true;
    });
  }, [rows, search, filter]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StickyMenu>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search characters…"
              className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
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
                onClick={() => setFilter(k)}
                className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  filter === k ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </StickyMenu>

      <PageScroll>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2/40 text-left text-xs uppercase tracking-wider text-fg-subtle">
                <th className="sticky left-0 z-10 bg-surface-2/40 px-3 py-2 font-medium">Character</th>
                <th className="px-2 py-2 text-center font-medium" title="Random Normal daily reward">
                  RN
                </th>
                <th className="px-2 py-2 text-center font-medium" title="Random Veteran daily reward">
                  RV
                </th>
                {WRIT_CRAFTS.map((c) => (
                  <th key={c} className="px-2 py-2 text-center font-medium" title={`${WRIT_LABELS[c]} writ`}>
                    {WRIT_ABBR[c]}
                  </th>
                ))}
                <th className="px-2 py-2 text-center font-medium" title={PLEDGE_GIVER_NAMES.maj}>
                  Maj
                </th>
                <th className="px-2 py-2 text-center font-medium" title={PLEDGE_GIVER_NAMES.glirion}>
                  Gli
                </th>
                <th className="px-2 py-2 text-center font-medium" title={PLEDGE_GIVER_NAMES.urgarlag}>
                  Urg
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.characterId} className="border-b border-border/50 align-middle last:border-0 hover:bg-surface-2/30">
                  <td className="sticky left-0 z-10 bg-surface px-3 py-1.5">
                    <a href={`/characters/${encodeURIComponent(r.characterId)}`} className="font-medium text-fg hover:text-accent">
                      {r.name}
                    </a>
                    <div className="text-[11px] text-fg-subtle">{r.className}</div>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <DailyCellView cell={r.randomNormal} />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <DailyCellView cell={r.randomVeteran} />
                  </td>
                  {WRIT_CRAFTS.map((c) => (
                    <td key={c} className="px-2 py-1.5 text-center">
                      <DailyCellView cell={r.writs[c]} />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center">
                    <DailyCellView cell={r.pledges.maj} />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <DailyCellView cell={r.pledges.glirion} />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <DailyCellView cell={r.pledges.urgarlag} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="mt-3 rounded-xl border border-border bg-surface/70 px-6 py-10 text-center text-sm text-fg-muted">
            Nothing matches these filters.
          </div>
        )}

        <p className="mt-3 text-xs text-fg-subtle">
          Check = done. ACCEPT = in the journal. A timer is the random-dungeon reward cooldown as of last
          logout. A question mark means we have not scanned this character since the 10:00 UTC reset — we
          never pretend yesterday is still available.
        </p>
      </PageScroll>
    </div>
  );
}
