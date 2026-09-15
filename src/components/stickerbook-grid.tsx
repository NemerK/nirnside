"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Minus, Search } from "lucide-react";
import type { StickerbookSet } from "@/lib/snapshot/schema";
import { GameIcon } from "./game-icon";

type SetWithTotals = StickerbookSet & { total: number; collected: number; href?: string };

const STATUS = [
  { key: "all", label: "All" },
  { key: "incomplete", label: "Incomplete" },
  { key: "complete", label: "Complete" },
] as const;

type Status = (typeof STATUS)[number]["key"];

export function StickerbookGrid({ sets }: { sets: SetWithTotals[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [category, setCategory] = useState<string>("__all");

  // Category rail with per-category collected/total, like the in-game tree.
  const categories = useMemo(() => {
    const map = new Map<string, { collected: number; total: number; sets: number }>();
    for (const s of sets) {
      const c = s.category || "Unknown";
      const cur = map.get(c) ?? { collected: 0, total: 0, sets: 0 };
      cur.collected += s.collected;
      cur.total += s.total;
      cur.sets += 1;
      map.set(c, cur);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sets]);

  const grandTotal = useMemo(
    () => sets.reduce((a, s) => ({ collected: a.collected + s.collected, total: a.total + s.total }), {
      collected: 0,
      total: 0,
    }),
    [sets],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return sets.filter((s) => {
      if (category !== "__all" && (s.category || "Unknown") !== category) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      const complete = s.total > 0 && s.collected === s.total;
      if (status === "complete" && !complete) return false;
      if (status === "incomplete" && complete) return false;
      return true;
    });
  }, [sets, search, status, category]);

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Category rail */}
      <aside className="lg:w-56 lg:shrink-0">
        <div className="flex gap-1.5 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          <CategoryButton
            label="All Sets"
            collected={grandTotal.collected}
            total={grandTotal.total}
            active={category === "__all"}
            onClick={() => setCategory("__all")}
          />
          {categories.map((c) => (
            <CategoryButton
              key={c.name}
              label={c.name}
              collected={c.collected}
              total={c.total}
              active={category === c.name}
              onClick={() => setCategory(c.name)}
            />
          ))}
        </div>
      </aside>

      {/* Sets */}
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sets…"
              className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
            />
          </div>
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
            {STATUS.map((s) => (
              <button
                key={s.key}
                onClick={() => setStatus(s.key)}
                className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                  status === s.key ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3 text-sm text-fg-muted">
          {filtered.length} {filtered.length === 1 ? "set" : "sets"}
          {category !== "__all" && <span className="text-fg-subtle"> · {category}</span>}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface/70 px-6 py-12 text-center text-sm text-fg-muted">
            No sets match these filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filtered.map((s) => (
              <SetCard key={s.setId} set={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryButton({
  label,
  collected,
  total,
  active,
  onClick,
}: {
  label: string;
  collected: number;
  total: number;
  active: boolean;
  onClick: () => void;
}) {
  const done = total > 0 && collected === total;
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors lg:w-full ${
        active
          ? "border-accent/50 bg-accent-soft text-fg"
          : "border-border bg-surface/70 text-fg-muted hover:border-accent/30 hover:text-fg"
      }`}
    >
      <span className="flex items-center gap-2 truncate">
        {done && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
        <span className="truncate font-medium">{label}</span>
      </span>
      <span className={`shrink-0 text-xs ${active ? "text-accent" : "text-fg-subtle"}`}>
        {collected}/{total}
      </span>
    </button>
  );
}

function SetCard({ set: s }: { set: SetWithTotals }) {
  const complete = s.total > 0 && s.collected === s.total;
  const pct = s.total > 0 ? Math.round((s.collected / s.total) * 100) : 0;

  return (
    <div
      className={`rounded-xl border bg-surface/70 p-4 transition-colors ${
        complete ? "border-accent/50" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {s.href ? (
            <Link href={s.href} className="truncate font-medium text-fg hover:text-accent hover:underline">
              {s.name}
            </Link>
          ) : (
            <div className="truncate font-medium text-fg">{s.name}</div>
          )}
          <div className="mt-0.5 text-xs text-fg-subtle">{s.category}</div>
        </div>
        {complete ? (
          <span className="flex h-6 shrink-0 items-center gap-1 rounded-md border border-accent/40 bg-accent-soft px-1.5 text-xs text-accent">
            <Check className="h-3 w-3" /> Complete
          </span>
        ) : (
          <span className="shrink-0 text-xs text-fg-muted">
            {s.collected}/{s.total}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {s.pieces.map((p, i) => {
          const label = p.type || p.slot;
          return (
            <span
              key={`${p.slot}-${i}`}
              title={`${label}${p.name && p.name !== label ? ` — ${p.name}` : ""} · ${
                p.collected ? "collected" : "missing"
              }`}
              className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-xs ${
                p.collected
                  ? "border-accent/40 bg-accent-soft text-fg"
                  : "border-border/70 bg-surface-2/50 text-fg-subtle"
              }`}
            >
              <span className={`relative shrink-0 ${p.collected ? "" : "opacity-40 grayscale"}`}>
                <GameIcon name={label} icon={p.icon} size={22} />
              </span>
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {p.collected ? (
                <Check className="h-3 w-3 shrink-0 text-accent" />
              ) : (
                <Minus className="h-3 w-3 shrink-0 text-fg-subtle/60" />
              )}
            </span>
          );
        })}
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
