"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Search, Target } from "lucide-react";
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
    return <td className="border-b border-border/60 px-1" aria-label={cellTitle(column, row, cell)} />;
  }
  const goal = cell.target ? cell.target.rank || cell.target.extra : null;
  const finish = goal ?? row.cap;
  const fill = cellFill(cell, row.cap);
  const missed = cell.target && cell.state !== "done";
  return (
    <td className="border-b border-border/60 p-0.5">
      <button
        type="button"
        onClick={onPick}
        title={cellTitle(column, row, cell)}
        className={`group relative flex h-9 w-full items-center justify-center overflow-hidden rounded-md text-[13px] tabular-nums transition-colors hover:ring-1 hover:ring-border-strong ${
          cell.state === "done" ? "bg-ok/12 text-ok" : "bg-surface-2/60"
        }`}
      >
        {cell.state === "short" ? (
          <span
            className={`absolute inset-y-0 left-0 ${missed ? "bg-accent/25" : "bg-fg/10"}`}
            style={{ width: `${fill * 100}%` }}
            aria-hidden
          />
        ) : null}
        <span className="relative">
          {cell.state === "done" ? (
            <span className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5" aria-hidden />
              {cell.rank}
            </span>
          ) : cell.state === "short" ? (
            <span className={cell.subclassed ? "italic text-fg-muted" : "text-fg"}>
              {cell.rank}
              {finish ? <span className="text-fg-subtle">/{finish}</span> : null}
            </span>
          ) : cell.state === "undiscovered" ? (
            <span className="text-fg-subtle">
              —{goal ? <span>/{goal}</span> : null}
            </span>
          ) : (
            <span className="text-fg-subtle">?</span>
          )}
        </span>
        {cell.target ? (
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        ) : null}
      </button>
    </td>
  );
}

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

  const visibleCols = useMemo(
    () =>
      grid.columns
        .map((c, i) => ({ c, i }))
        .filter(({ c }) => !role || c.roleIds.includes(role)),
    [grid.columns, role],
  );

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return grid.groups
      .filter((g) => group === "all" || g.key === group)
      .map((g) => ({
        ...g,
        rows: g.rows.filter((r) => {
          if (q && !r.name.toLowerCase().includes(q)) return false;
          if (targeted && !r.targeted) return false;
          if (unfinished) {
            const cells = visibleCols.map(({ i }) => r.cells[i]).filter((c) => c.state !== "na");
            if (cells.length > 0 && cells.every((c) => c.state === "done")) return false;
          }
          return true;
        }),
      }))
      .filter((g) => g.rows.length > 0);
  }, [grid.groups, group, query, targeted, unfinished, visibleCols]);

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
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-fg-muted hover:text-fg">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="accent-[var(--accent)]" />
      {label}
    </label>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex shrink-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="relative min-w-[220px] flex-1 sm:max-w-xs">
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
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {chip("all", "All lines")}
          {grid.groups.map((g) => chip(g.key, g.title))}
        </div>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface px-4 py-10 text-center text-sm text-fg-muted">
          No lines match. Clear the search or filters.
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-surface">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 min-w-[200px] border-b border-border bg-surface px-4 py-2.5 text-left text-[13px] font-normal text-fg-subtle">
                  Skill line
                </th>
                {visibleCols.map(({ c }) => (
                  <th
                    key={c.id}
                    className="sticky top-0 z-20 min-w-[92px] max-w-[120px] border-b border-border bg-surface px-1 py-2 text-left align-bottom font-normal"
                  >
                    <Link
                      href={`/characters/${c.id}`}
                      title={`${c.name} — ${c.className}`}
                      className="flex items-center gap-1.5 px-1 text-[13px] text-fg hover:text-accent"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: classColor(c.className) ?? "var(--fg-subtle)" }}
                        aria-hidden
                      />
                      <span className={`truncate ${c.scanned ? "" : "italic text-fg-muted"}`}>{c.name}</span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            {groups.map((g) => (
              <tbody key={g.key}>
                <tr>
                  <th
                    colSpan={visibleCols.length + 1}
                    className="sticky left-0 z-10 bg-surface px-4 pb-1 pt-4 text-left"
                  >
                    <span className="flex items-center gap-2 font-display text-[17px] font-semibold text-fg">
                      {g.className ? (
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: classColor(g.className) ?? "var(--fg-subtle)" }}
                          aria-hidden
                        />
                      ) : null}
                      {g.title}
                    </span>
                  </th>
                </tr>
                {g.rows.map((r) => (
                  <tr key={`${g.key}-${r.name}`} className="group/row">
                    <th className="sticky left-0 z-10 border-b border-border/60 bg-surface px-2 py-0 text-left font-normal">
                      <button
                        type="button"
                        onClick={() => setOpen({ subject: subjectOf(r), characterId: null })}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-fg hover:bg-surface-2"
                        title={`Set a target for ${r.name}`}
                      >
                        <span className={`min-w-0 flex-1 truncate ${r.complete ? "text-fg-muted" : ""}`}>{r.name}</span>
                        {r.cap ? <span className="text-[12px] tabular-nums text-fg-subtle">{r.cap}</span> : null}
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
            ))}
          </table>
        </div>
      )}

      <p className="mt-3 shrink-0 text-[12px] text-fg-subtle">
        Click a line to set a target for a group, or a cell to set one for that character. A gold dot marks a cell with
        a target. — means not found yet, ? means that character hasn&apos;t been snapshotted.
      </p>

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
