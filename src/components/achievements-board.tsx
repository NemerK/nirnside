"use client";

import { useMemo, useState } from "react";
import { Check, Crown, Minus, Search, Trophy } from "lucide-react";
import { CONTENT_ORDER, type AchColumn, type ContentCategory } from "@/lib/achievements/classify";
import type { BoardRow, Cell, CellItem } from "@/lib/achievements/board";

type Filter = "all" | "earned" | "partial" | "missing";
type RenderMode = "check" | "named";

interface ColSpec {
  col: AchColumn;
  /** Header label, matching the in-game Pithka windows. */
  label: string;
  mode: RenderMode;
}

/**
 * Column layouts mirror the two Pithka windows you shared:
 *  - Dungeons/Arenas: Vet · HM · SR · ND as check columns, then the named
 *    "Challenger & Trifecta" and "Extras" columns.
 *  - Trials: Vet (check), then Hard Mode listed per-boss, Trifecta and Extra
 *    as named columns.
 */
const DUNGEON_COLS: ColSpec[] = [
  { col: "Vet", label: "Vet", mode: "check" },
  { col: "Hard Mode", label: "HM", mode: "check" },
  { col: "Speed", label: "SR", mode: "check" },
  { col: "No Death", label: "ND", mode: "check" },
  { col: "Trifecta", label: "Challenger & Trifecta", mode: "named" },
  { col: "Extras", label: "Extras", mode: "named" },
];

const TRIAL_COLS: ColSpec[] = [
  { col: "Vet", label: "Vet", mode: "check" },
  { col: "Hard Mode", label: "Hard Mode", mode: "named" },
  { col: "Trifecta", label: "Trifecta", mode: "named" },
  { col: "Extras", label: "Extra", mode: "named" },
];

const COLS_BY_CATEGORY: Record<ContentCategory, ColSpec[]> = {
  Trial: TRIAL_COLS,
  Dungeon: DUNGEON_COLS,
  Arena: DUNGEON_COLS,
  Other: DUNGEON_COLS,
};

const TAB_LABEL: Record<ContentCategory, string> = {
  Trial: "Trials",
  Dungeon: "Dungeons",
  Arena: "Arenas",
  Other: "Other",
};

export function AchievementsBoard({ rows }: { rows: BoardRow[] }) {
  const tabs = useMemo<ContentCategory[]>(
    () => CONTENT_ORDER.filter((c) => rows.some((r) => r.category === c)),
    [rows],
  );
  const [tab, setTab] = useState<ContentCategory>(tabs[0] ?? "Trial");
  const activeTab = tabs.includes(tab) ? tab : tabs[0] ?? "Trial";

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const tabRows = useMemo(() => rows.filter((r) => r.category === activeTab), [rows, activeTab]);

  // Only render columns this tab actually has data for (keeps the grid tidy).
  const cols = useMemo<ColSpec[]>(() => {
    const spec = COLS_BY_CATEGORY[activeTab] ?? DUNGEON_COLS;
    const used = spec.filter((c) => tabRows.some((r) => r.cells[c.col].total > 0));
    return used.length ? used : spec.slice(0, 1);
  }, [activeTab, tabRows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tabRows.filter((r) => {
      if (q && !r.content.toLowerCase().includes(q)) return false;
      const done = r.totalCount > 0 && r.earnedCount === r.totalCount;
      if (filter === "earned" && !done) return false;
      if (filter === "missing" && r.earnedCount !== 0) return false;
      if (filter === "partial" && (r.earnedCount === 0 || done)) return false;
      return true;
    });
  }, [tabRows, search, filter]);

  const summary = useMemo(() => {
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
      {/* Tabs — separate windows in Pithka. */}
      <div className="mb-4 flex flex-wrap items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg"
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
          {summary.earned}/{summary.total} · {summary.tri}/{summary.triTotal} trifectas
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/40 text-left text-xs uppercase tracking-wider text-fg-subtle">
              <th className="sticky left-0 z-10 bg-surface-2/40 px-4 py-2.5 font-medium">
                {TAB_LABEL[activeTab].replace(/s$/, "")}
              </th>
              {cols.map((c) => (
                <th
                  key={c.col}
                  className={`px-3 py-2.5 font-medium ${c.mode === "check" ? "text-center" : "text-left"}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.content} className="border-b border-border/50 align-top last:border-0 hover:bg-surface-2/30">
                <td className="sticky left-0 z-10 bg-surface px-4 py-3">
                  <div className="font-medium text-fg">{r.content}</div>
                  <div className="mt-0.5 text-xs text-fg-subtle">
                    {r.earnedCount}/{r.totalCount} · {r.points.earned.toLocaleString()} pts
                  </div>
                </td>
                {cols.map((c) => (
                  <td key={c.col} className={`px-3 py-3 ${c.mode === "check" ? "text-center" : ""}`}>
                    {c.mode === "check" ? (
                      <CheckCell cell={r.cells[c.col]} />
                    ) : (
                      <NamedCell cell={r.cells[c.col]} />
                    )}
                  </td>
                ))}
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

      <p className="mt-3 text-xs text-fg-subtle">
        Rows are each trial, dungeon and arena; every check and name is read straight from your account&apos;s
        achievements. Trial Hard Mode lists each boss&apos;s hard-mode achievement. Leaderboard best scores aren&apos;t
        exported by the game to add-ons, so they&apos;re not shown.
      </p>
    </div>
  );
}

/** A compact challenge column (Vet / HM / SR / ND): check, count, or empty. */
function CheckCell({ cell }: { cell: Cell }) {
  if (cell.total === 0) return <span className="text-fg-subtle/30">·</span>;
  const title = itemsTitle(cell.items);

  if (cell.earned === cell.total) {
    return (
      <span
        title={title}
        className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border border-accent/40 bg-accent-soft px-1 text-accent"
      >
        {cell.total > 1 ? <span className="text-xs font-semibold">{cell.total}/{cell.total}</span> : <Check className="h-3.5 w-3.5" />}
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

/** A named column (Trifecta / Extras / per-boss HM): one labeled row per achievement. */
function NamedCell({ cell }: { cell: Cell }) {
  if (cell.items.length === 0) return <span className="text-fg-subtle/30">—</span>;
  return (
    <div className="flex flex-col gap-1">
      {cell.items.map((it, i) => (
        <span
          key={`${it.name}-${i}`}
          title={`${it.name}${it.title ? ` · title: ${it.title}` : ""} — ${
            it.completed ? `earned${it.date ? ` (${it.date})` : ""}` : "not earned"
          }`}
          className={`inline-flex max-w-[15rem] items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs ${
            it.completed
              ? "border-accent/40 bg-accent-soft text-fg"
              : "border-border/60 bg-surface-2/40 text-fg-subtle"
          }`}
        >
          {it.completed ? (
            <Check className="h-3 w-3 shrink-0 text-accent" />
          ) : (
            <Minus className="h-3 w-3 shrink-0 text-fg-subtle/60" />
          )}
          <span className="truncate">{it.name}</span>
          {it.title && (
            <Crown
              className={`h-3 w-3 shrink-0 ${it.completed ? "text-amber-500 dark:text-amber-400" : "text-fg-subtle/50"}`}
            />
          )}
        </span>
      ))}
    </div>
  );
}

function itemsTitle(items: CellItem[]): string {
  return items
    .map((i) => `${i.completed ? "✓" : "✗"} ${i.name}${i.completed && i.date ? ` (${i.date})` : ""}`)
    .join("\n");
}
