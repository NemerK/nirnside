"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { classIcon } from "@/lib/classes";
import type { CharacterWorkspaceCard, ProgressTally } from "@/lib/characters/workspace";
import { GalleryLink } from "../gallery-link";
import { GameIcon } from "../game-icon";
import { RoleBadge } from "../role-badge";

function move<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

function Bar({ tally, unscanned }: { tally: ProgressTally; unscanned?: boolean }) {
  if (unscanned || (tally.total === 0 && (tally.unknownCount ?? 0) > 0)) {
    return <span className="text-xs text-fg-subtle">?</span>;
  }
  if (tally.total === 0) {
    return <span className="text-xs text-fg-subtle">—</span>;
  }
  return (
    <div className="flex w-full items-center gap-2">
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--meter-track,#3e4858)]">
        <div className="h-full rounded-full bg-[var(--meter,#3dce7a)]" style={{ width: `${tally.pct}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-[var(--meter,#3dce7a)]">
        {tally.pct}%
      </span>
    </div>
  );
}

/**
 * Reorderable roster. The grip is the only drag handle so the name stays a link.
 * Order is saved locally and survives the next snapshot.
 */
type SortKey = "class" | "name" | "role" | "targets" | "research";

function sortValue(card: CharacterWorkspaceCard, key: SortKey): string | number {
  if (key === "class") return card.className;
  if (key === "name") return card.name;
  if (key === "role") return card.roles.map((role) => role.name).join(", ");
  if (key === "targets") return card.mandatoryTargets.pct;
  return card.research.pct;
}

export function RosterList({
  cards,
  photoCounts = {},
}: {
  cards: CharacterWorkspaceCard[];
  photoCounts?: Record<string, number>;
}) {
  const [rows, setRows] = useState(cards);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);

  function toggleSort(key: SortKey) {
    setSort((current) => {
      if (!current || current.key !== key) return { key, dir: "asc" };
      if (current.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  const shown = useMemo(() => {
    if (!sort) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, sort]);

  async function persist(next: CharacterWorkspaceCard[]) {
    const previous = rows;
    setRows(next);
    try {
      const res = await fetch("/api/roster-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ order: next.map((row) => row.id) }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setRows(previous);
    }
  }

  function dropOn(sourceId: string, targetId: string) {
    if (!sourceId || sourceId === targetId) return;
    const from = rows.findIndex((row) => row.id === sourceId);
    const to = rows.findIndex((row) => row.id === targetId);
    void persist(move(rows, from, to));
  }

  const columns =
    "grid-cols-[2rem_2.25rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[2rem_2.25rem_13rem_9rem_11.5rem_11.5rem] sm:justify-start sm:gap-x-5";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div
        className={`hidden items-center border-b border-border px-2 py-2 text-[11px] font-medium text-fg-subtle sm:grid ${columns}`}
      >
        <span aria-hidden="true" />
        <SortHeader label="Class" sortKey="class" sort={sort} onSort={toggleSort} />
        <SortHeader label="Name" sortKey="name" sort={sort} onSort={toggleSort} />
        <SortHeader label="Role" sortKey="role" sort={sort} onSort={toggleSort} />
        <SortHeader label="Targets" sortKey="targets" sort={sort} onSort={toggleSort} />
        <SortHeader label="Research" sortKey="research" sort={sort} onSort={toggleSort} />
      </div>
      <ul>
        {shown.map((card) => (
          <li
            key={card.id}
            onDragOver={(event) => {
              event.preventDefault();
              if (dragId && dragId !== card.id) setOverId(card.id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              dropOn(event.dataTransfer.getData("text/plain") || dragId || "", card.id);
              setDragId(null);
              setOverId(null);
            }}
            className={`grid items-center gap-y-2 border-b border-border px-2 py-2 last:border-b-0 ${columns} ${
              overId === card.id ? "bg-accent-soft shadow-[inset_0_2px_0_0_var(--accent)]" : ""
            } ${dragId === card.id ? "opacity-40" : ""}`}
          >
            <button
              type="button"
              draggable={!sort}
              aria-label={`Drag ${card.name}`}
              title={sort ? "Clear the column sort to drag" : "Drag to reorder"}
              disabled={!!sort}
              onDragStart={(event) => {
                setDragId(card.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", card.id);
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              className={`flex h-8 w-8 items-center justify-center rounded text-fg-subtle hover:bg-surface-2 hover:text-fg ${
                sort ? "cursor-not-allowed opacity-40" : "cursor-grab active:cursor-grabbing"
              }`}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <GameIcon name={card.className} icon={classIcon(card.className)} size={28} bare />
            <div className="min-w-0">
              <Link href={`/characters/${encodeURIComponent(card.id)}`} className="min-w-0">
                <span className="block truncate text-sm font-medium text-fg hover:text-accent">{card.name}</span>
                <span className="block truncate text-xs text-fg-subtle sm:hidden">{card.className}</span>
              </Link>
              <GalleryLink
                href={`/characters/${encodeURIComponent(card.id)}/gallery`}
                count={photoCounts[card.id] ?? 0}
              />
            </div>
            <div className="col-span-3 min-w-0 pl-11 sm:col-span-1 sm:pl-0">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-fg-subtle sm:hidden">Role</p>
              {card.roles.length === 0 ? (
                <span className="text-xs text-fg-subtle">—</span>
              ) : (
                <span className="flex flex-wrap gap-1">
                  {card.roles.map((role) => (
                    <RoleBadge key={role.id} role={role} />
                  ))}
                </span>
              )}
            </div>
            <div className="col-span-3 min-w-0 pl-11 sm:col-span-1 sm:pl-0">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-fg-subtle sm:hidden">Targets</p>
              <Bar tally={card.mandatoryTargets} unscanned={card.unknown} />
            </div>
            <div className="col-span-3 min-w-0 pl-11 sm:col-span-1 sm:pl-0">
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-fg-subtle sm:hidden">Research</p>
              <Bar tally={card.research} unscanned={card.unknown} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" } | null;
  onSort: (key: SortKey) => void;
}) {
  const active = sort?.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`inline-flex items-center gap-1 text-left uppercase tracking-wider ${
        active ? "text-fg" : "text-fg-subtle hover:text-fg"
      }`}
    >
      {label}
      {active ? (
        sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
      ) : null}
    </button>
  );
}
