"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, HelpCircle, Minus, Search } from "lucide-react";
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

type Filter = "all" | "open" | "done";

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

function ModeMark({ label, title, tone }: { label: string; title: string; tone: "hm" | "vet" | "norm" }) {
  const cls =
    tone === "hm"
      ? "border-amber-400/50 bg-amber-400/15 text-amber-600 dark:text-amber-400"
      : tone === "vet"
        ? "border-rose-400/50 bg-rose-400/15 text-rose-600 dark:text-rose-300"
        : "border-sky-400/50 bg-sky-400/15 text-sky-700 dark:text-sky-300";
  return (
    <span
      title={title}
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded border px-0.5 text-[9px] font-bold leading-none ${cls}`}
    >
      {label}
    </span>
  );
}

function DailyCellView({ cell }: { cell: DailyCell }) {
  if (cell.status === "done" && cell.hardMode === true) {
    return <ModeMark label="HM" title={cell.title} tone="hm" />;
  }
  if (cell.status === "done" && cell.difficulty === "veteran") {
    return <ModeMark label="Vet" title={cell.title} tone="vet" />;
  }
  if (cell.status === "done" && (cell.difficulty === "normal" || cell.hardMode === false)) {
    return <ModeMark label="N" title={cell.title} tone="norm" />;
  }
  if (cell.status === "done" || cell.status === "cooldown") {
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

function ResetCountdown({ resetAt }: { resetAt: number }) {
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
    </div>
  );
}

function PledgeHead({ giver, today }: { giver: PledgeGiver; today?: string }) {
  return (
    <th className="px-2 py-2 text-center font-medium" title={PLEDGE_GIVER_NAMES[giver]}>
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
}: {
  rows: PresentedCharacterDailies[];
  resetAt: number;
  todayPledges: Record<PledgeGiver, string>;
}) {
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
          <ResetCountdown resetAt={resetAt} />
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
                <PledgeHead giver="maj" today={todayPledges.maj} />
                <PledgeHead giver="glirion" today={todayPledges.glirion} />
                <PledgeHead giver="urgarlag" today={todayPledges.urgarlag} />
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
          Check = done today. Pledge <span className="font-semibold text-fg-muted">N</span> /{" "}
          <span className="font-semibold text-fg-muted">Vet</span> /{" "}
          <span className="font-semibold text-fg-muted">HM</span> = normal, veteran, or hard mode.
          ACCEPT only when the journal dungeon is today&apos;s daily — a leftover from another day
          stays unmarked.
          Today&apos;s three names are the community rotation, not an in-game scan. A dash on randoms
          means the daily reward is still available. A question mark on a writ or pledge means it is
          not in the journal (or is yesterday&apos;s leftover) and we did not see the turn-in.
        </p>
      </PageScroll>
    </div>
  );
}
