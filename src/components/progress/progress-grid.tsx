"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search, Target } from "lucide-react";
import { classColor } from "@/lib/classes";
import type { Goal } from "@/lib/goals/types";
import { cellFill, type GridColumn, type LineCell, type LineGrid, type LineRow } from "@/lib/progress/grid";
import { TargetSheet, type TargetSubject } from "@/components/targets/target-sheet";

type Open = { subject: TargetSubject; characterId: string | null } | null;

function subjectOf(row: LineRow): TargetSubject {
  return { domain: "skillline", name: row.name, cap: row.cap, className: row.className, context: row.className ?? row.category };
}

const SCOPE_WORD: Record<string, string> = {
  account: "everyone",
  class: "this class",
  role: "a role",
  character: "this character",
};

function cellTitle(column: GridColumn, row: LineRow, cell: LineCell): string {
  const who = column.name;
  const goal = cell.target ? cell.target.rank || cell.target.extra : null;
  const targetText = cell.target ? ` Target ${goal} (set for ${SCOPE_WORD[cell.target.scope]}).` : "";
  switch (cell.state) {
    case "na":
      return `${who}: ${cell.reason ?? "not this character's line"}`;
    case "unknown":
      return `${who}: not snapshotted yet — log out on this character once.${targetText}`;
    case "undiscovered":
      return `${who}: hasn't found ${row.name} yet.${targetText}`;
    default:
      return `${who}: ${row.name} rank ${cell.rank}${row.cap ? ` of ${row.cap}` : ""}${
        cell.subclassed ? " (subclassed — not counted towards targets)" : ""
      }.${targetText}`;
  }
}

function Cell({ column, row, cell, onPick }: { column: GridColumn; row: LineRow; cell: LineCell; onPick: () => void }) {
  if (cell.state === "na") {
    return <td className="border-b border-border/40 p-0" aria-label={cellTitle(column, row, cell)} />;
  }
  const fill = cellFill(cell, row.cap);
  const missed = cell.target && cell.state !== "done";
  return (
    <td className="border-b border-border/40 p-[2px]">
      <button
        type="button"
        onClick={onPick}
        title={cellTitle(column, row, cell)}
        aria-label={cellTitle(column, row, cell)}
        className={`relative flex h-7 w-full items-center justify-center overflow-hidden rounded text-[12px] tabular-nums transition-colors hover:ring-1 hover:ring-border-strong ${
          cell.state === "done" ? "bg-ok/15 text-ok" : "bg-surface-2/50"
        }`}
      >
        {cell.state === "short" ? (
          <span
            className={`absolute inset-y-0 left-0 ${missed ? "bg-accent/30" : "bg-fg/12"}`}
            style={{ width: `${fill * 100}%` }}
            aria-hidden
          />
        ) : null}
        <span className={`relative ${cell.state === "short" ? (cell.subclassed ? "italic text-fg-muted" : "text-fg") : ""}`}>
          {cell.state === "done" || cell.state === "short" ? (
            cell.rank
          ) : cell.state === "undiscovered" ? (
            <span className="text-fg-subtle">–</span>
          ) : (
            <span className="text-fg-subtle">?</span>
          )}
        </span>
        {cell.target ? <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden /> : null}
      </button>
    </td>
  );
}

/** "5/6": how many of the characters a group applies to have finished it. */
function GroupSummary({ rows, col }: { rows: LineRow[]; col: number }) {
  let done = 0;
  let total = 0;
  for (const r of rows) {
    const c = r.cells[col];
    if (!c || c.state === "na") continue;
    total += 1;
    if (c.state === "done") done += 1;
  }
  if (total === 0) return <td className="border-b border-border/60" />;
  const all = done === total;
  return (
    <td className="border-b border-border/60 px-[2px] py-1 text-center">
      <span
        className={`block rounded text-[11px] tabular-nums ${all ? "text-ok" : done === 0 ? "text-fg-subtle" : "text-fg-muted"}`}
        title={`${done} of ${total} lines finished`}
      >
        {done}/{total}
      </span>
    </td>
  );
}

const COLLAPSE_KEY = "nirnside-compare-collapsed";

export function ProgressGrid({
  grid,
  goals,
  roles,
}: {
  grid: LineGrid;
  goals: Goal[];
  roles: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("all");
  const [unfinished, setUnfinished] = useState(false);
  const [targeted, setTargeted] = useState(false);
  const [role, setRole] = useState<string>("");
  const [open, setOpen] = useState<Open>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSE_KEY) ?? "[]");
      // Restoring a remembered choice after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved)) setCollapsed(new Set(saved.filter((k) => typeof k === "string")));
    } catch {
      /* storage can be off */
    }
  }, []);

  function saveCollapsed(next: Set<string>) {
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next]));
    } catch {
      /* storage can be off */
    }
  }

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return grid.groups
      .filter((g) => group === "all" || g.key === group)
      .map((g) => ({
        ...g,
        rows: g.rows.filter((r) => {
          if (q && !r.name.toLowerCase().includes(q)) return false;
          if (targeted && !r.targeted) return false;
          if (unfinished && r.cells.every((c) => c.state === "na" || c.state === "done")) return false;
          return true;
        }),
      }))
      .filter((g) => g.rows.length > 0);
  }, [grid.groups, group, query, targeted, unfinished]);

  // Characters to show: the chosen role, and when the rows on screen belong to
  // one class, only the characters those lines apply to (no empty columns).
  const visibleCols = useMemo(() => {
    const rows = groups.flatMap((g) => g.rows);
    return grid.columns
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !role || c.roleIds.includes(role))
      .filter(({ i }) => group === "all" || rows.some((r) => r.cells[i]?.state !== "na"));
  }, [grid.columns, role, groups, group]);

  const filtering = query.trim() !== "" || unfinished || targeted;
  const isCollapsed = (key: string) => !filtering && group === "all" && collapsed.has(key);
  const allCollapsed = grid.groups.every((g) => collapsed.has(g.key));

  const chip = (key: string, label: string) => (
    <button
      key={key}
      type="button"
      onClick={() => setGroup(key)}
      aria-pressed={group === key}
      className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[13px] transition-colors ${
        group === key ? "bg-accent-soft text-fg ring-1 ring-inset ring-accent/50" : "text-fg-muted hover:bg-surface hover:text-fg"
      }`}
    >
      {label}
    </button>
  );

  const toggle = (on: boolean, set: (v: boolean) => void, label: string) => (
    <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-[13px] text-fg-muted hover:text-fg">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="accent-[var(--accent)]" />
      {label}
    </label>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <label className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a skill line"
            aria-label="Find a skill line"
            className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-border-strong focus:outline-none"
          />
        </label>
        {roles.length > 0 ? (
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            aria-label="Show characters with role"
            className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-fg"
          >
            <option value="">All characters</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} only
              </option>
            ))}
          </select>
        ) : null}
        {toggle(unfinished, setUnfinished, "Unfinished only")}
        {toggle(targeted, setTargeted, "With a target")}
        <button
          type="button"
          onClick={() => saveCollapsed(allCollapsed ? new Set() : new Set(grid.groups.map((g) => g.key)))}
          className="whitespace-nowrap text-[13px] text-accent hover:underline"
        >
          {allCollapsed ? "Expand all groups" : "Collapse all groups"}
        </button>
        <p className="ml-auto hidden text-[12px] text-fg-subtle xl:block">
          Click a line or a cell to set a target · <span className="text-ok">green</span> finished · gold dot has a target ·
          – not found · ? not snapshotted
        </p>
      </div>
      <div className="-mx-1 mb-3 flex shrink-0 gap-1 overflow-x-auto px-1 pb-1">
        {chip("all", "All lines")}
        {grid.groups.map((g) => chip(g.key, g.title))}
      </div>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-10 text-center text-sm text-fg-muted">
          No lines match. Clear the search or filters.
        </p>
      ) : (
        <div className="min-h-[320px] flex-1 overflow-auto rounded-xl border border-border bg-surface">
          <table className="border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 w-[230px] min-w-[230px] border-b border-border bg-surface px-4 pb-2 text-left align-bottom text-[12px] font-normal text-fg-subtle">
                  Skill line <span className="text-fg-subtle/80">· max rank</span>
                </th>
                {visibleCols.map(({ c }) => (
                  <th
                    key={c.id}
                    className="sticky top-0 z-20 w-11 min-w-11 border-b border-border bg-surface px-0 pb-2 pt-2 align-bottom font-normal"
                  >
                    <Link
                      href={`/party/c/${encodeURIComponent(c.id)}/skills`}
                      title={`${c.name} — ${c.className}${c.scanned ? "" : " (not snapshotted yet)"}`}
                      className="mx-auto flex max-h-[190px] flex-col items-center gap-1.5 text-[12px] text-fg-muted hover:text-fg"
                    >
                      <span
                        className={`truncate [writing-mode:vertical-rl] rotate-180 ${c.scanned ? "" : "italic opacity-70"}`}
                      >
                        {c.name}
                      </span>
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: classColor(c.className) ?? "var(--fg-subtle)" }}
                        aria-hidden
                      />
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((g) => {
              const shut = isCollapsed(g.key);
              return (
                <tbody key={g.key}>
                  <tr>
                    <th className="sticky left-0 z-10 border-b border-border/60 bg-surface-2/40 p-0 text-left font-normal backdrop-blur">
                      <button
                        type="button"
                        onClick={() => {
                          const next = new Set(collapsed);
                          if (next.has(g.key)) next.delete(g.key);
                          else next.add(g.key);
                          saveCollapsed(next);
                        }}
                        disabled={filtering || group !== "all"}
                        aria-expanded={!shut}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left"
                      >
                        <ChevronRight
                          className={`h-3.5 w-3.5 shrink-0 text-fg-subtle transition-transform ${shut ? "" : "rotate-90"}`}
                          aria-hidden
                        />
                        {g.className ? (
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: classColor(g.className) ?? "var(--fg-subtle)" }}
                            aria-hidden
                          />
                        ) : null}
                        <span className="text-[13px] font-semibold text-fg">{g.title}</span>
                        <span className="text-[11px] text-fg-subtle">{g.rows.length}</span>
                      </button>
                    </th>
                    {visibleCols.map(({ c, i }) => (
                      <GroupSummary key={c.id} rows={g.rows} col={i} />
                    ))}
                  </tr>
                  {shut
                    ? null
                    : g.rows.map((r) => (
                        <tr key={`${g.key}-${r.name}`} className="group/row">
                          <th className="sticky left-0 z-10 border-b border-border/40 bg-surface p-0 text-left font-normal">
                            <button
                              type="button"
                              onClick={() => setOpen({ subject: subjectOf(r), characterId: null })}
                              className="flex w-full items-center gap-2 py-1 pl-8 pr-3 text-left text-[13px] text-fg hover:bg-surface-2"
                              title={`Set a target for ${r.name}`}
                            >
                              <span className={`min-w-0 flex-1 truncate ${r.complete ? "text-fg-muted" : ""}`}>{r.name}</span>
                              {r.cap ? <span className="text-[11px] tabular-nums text-fg-subtle">{r.cap}</span> : null}
                              <Target
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  r.targeted ? "text-accent" : "text-fg-subtle opacity-0 group-hover/row:opacity-100"
                                }`}
                                aria-label={r.targeted ? "Has a target" : undefined}
                              />
                            </button>
                          </th>
                          {visibleCols.map(({ c, i }) => (
                            <Cell
                              key={c.id}
                              column={c}
                              row={r}
                              cell={r.cells[i]}
                              onPick={() => setOpen({ subject: subjectOf(r), characterId: c.id })}
                            />
                          ))}
                        </tr>
                      ))}
                </tbody>
              );
            })}
          </table>
        </div>
      )}

      {open ? (
        <TargetSheet
          subject={open.subject}
          people={grid.columns}
          roles={roles}
          goals={goals}
          initial={
            open.characterId
              ? { scope: "character", characterId: open.characterId, scopeKey: null }
              : { scope: "account", characterId: null, scopeKey: null }
          }
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}
