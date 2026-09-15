"use client";

import { useMemo, useState } from "react";
import { Check, Minus, Search, Trophy, Award } from "lucide-react";
import { ACH_COLUMNS, CONTENT_ORDER, type AchColumn, type ContentCategory } from "@/lib/achievements/classify";
import type { BoardRow, Cell } from "@/lib/achievements/board";

type Filter = "all" | "earned" | "partial" | "missing";

/** Short header labels so the grid stays readable. */
const COL_LABEL: Record<AchColumn, string> = {
  Completion: "Clear",
  "Hard Mode": "Hard Mode",
  Speed: "Speed",
  "No Death": "No Death",
  Trifecta: "Trifecta",
};

/** Pithka's tab order. Plural labels like the in-game tracker. */
const TAB_LABEL: Record<ContentCategory, string> = {
  Trial: "Trials",
  Dungeon: "Dungeons",
  Arena: "Arenas",
  Other: "Other",
};

export function AchievementsBoard({ rows }: { rows: BoardRow[] }) {
  // Which content categories actually have data → these become the tabs.
  const tabs = useMemo<ContentCategory[]>(
    () => CONTENT_ORDER.filter((c) => rows.some((r) => r.category === c)),
    [rows],
  );
  const [tab, setTab] = useState<ContentCategory>(tabs[0] ?? "Trial");
  const activeTab = tabs.includes(tab) ? tab : tabs[0] ?? "Trial";

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const tabRows = useMemo(() => rows.filter((r) => r.category === activeTab), [rows, activeTab]);

  // Only show columns this tab actually uses (dungeons vs trials differ).
  const activeCols = useMemo<AchColumn[]>(() => {
    const cols = ACH_COLUMNS.filter((c) => tabRows.some((r) => r.cells[c].total > 0));
    return cols.length ? cols : ["Completion"];
  }, [tabRows]);

  const showExtras = useMemo(() => tabRows.some((r) => r.titles.length > 0), [tabRows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tabRows.filter((r) => {
      if (q && !r.content.toLowerCase().includes(q)) return false;
      const done = r.earnedCount === r.totalCount && r.totalCount > 0;
      if (filter === "earned" && !done) return false;
      if (filter === "missing" && r.earnedCount !== 0) return false;
      if (filter === "partial" && (r.earnedCount === 0 || done)) return false;
      return true;
    });
  }, [tabRows, search, filter]);

  const tabSummary = useMemo(() => {
    let earned = 0;
    let total = 0;
    let tri = 0;
    let triTotal = 0;
    for (const r of tabRows) {
      earned += r.earnedCount;
      total += r.totalCount;
      tri += r.cells.Trifecta.earned;
      triTotal += r.cells.Trifecta.total;
    }
    return { earned, total, tri, triTotal };
  }, [tabRows]);

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t
                ? "border-accent text-fg"
                : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${TAB_LABEL[activeTab].toLowerCase()}…`}
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
          />
        </div>
        <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
          {(["all", "earned", "partial", "missing"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`rounded-md px-2.5 py-1.5 text-sm capitalize transition-colors ${
                filter === k ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <div className="text-sm text-fg-muted">
          {tabSummary.earned}/{tabSummary.total} · {tabSummary.tri}/{tabSummary.triTotal} trifectas
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-fg-subtle">
              <th className="px-4 py-2.5 font-medium">{TAB_LABEL[activeTab].replace(/s$/, "")}</th>
              {activeCols.map((c) => (
                <th key={c} className="px-3 py-2.5 text-center font-medium">
                  {COL_LABEL[c]}
                </th>
              ))}
              {showExtras && <th className="px-3 py-2.5 font-medium">Titles</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.content} className="border-b border-border/50 last:border-0 hover:bg-surface-2/40">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-fg">{r.content}</div>
                  <div className="text-xs text-fg-subtle">
                    {r.earnedCount}/{r.totalCount} · {r.points.earned}/{r.points.total} pts
                  </div>
                </td>
                {activeCols.map((col) => (
                  <td key={col} className="px-3 py-2.5 text-center">
                    <CellPill cell={r.cells[col]} />
                  </td>
                ))}
                {showExtras && (
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {r.titles.map((t) => (
                        <span
                          key={t.name}
                          title={
                            t.completed
                              ? `${t.name} — earned${t.date ? ` (${t.date})` : ""}`
                              : `${t.name} — not earned`
                          }
                          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs ${
                            t.completed
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-500 dark:text-amber-400"
                              : "border-border/70 text-fg-subtle"
                          }`}
                        >
                          <Award className="h-3 w-3" /> {t.name}
                        </span>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-border bg-surface/70 px-6 py-10 text-sm text-fg-muted">
          <Trophy className="h-4 w-4" /> No {TAB_LABEL[activeTab].toLowerCase()} match these filters.
        </div>
      )}
    </div>
  );
}

function CellPill({ cell }: { cell: Cell }) {
  if (cell.total === 0) return <span className="text-fg-subtle/40">·</span>;

  const title = cell.items
    .map((i) => `${i.completed ? "✓" : "✗"} ${i.name}${i.completed && i.date ? ` (${i.date})` : ""}`)
    .join("\n");

  if (cell.earned === cell.total) {
    return (
      <span
        title={title}
        className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-accent/40 bg-accent-soft px-1 text-accent"
      >
        {cell.total > 1 ? (
          <span className="text-xs font-semibold">
            {cell.total}/{cell.total}
          </span>
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
      </span>
    );
  }

  if (cell.earned > 0) {
    return (
      <span
        title={title}
        className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/10 px-1 text-xs font-semibold text-amber-500 dark:text-amber-400"
      >
        {cell.earned}/{cell.total}
      </span>
    );
  }

  return (
    <span
      title={title}
      className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-border/70 px-1 text-fg-subtle"
    >
      {cell.total > 1 ? <span className="text-xs">0/{cell.total}</span> : <Minus className="h-3.5 w-3.5" />}
    </span>
  );
}
