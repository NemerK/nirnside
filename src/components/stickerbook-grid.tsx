"use client";

import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import type { StickerbookSet } from "@/lib/snapshot/schema";

type SetWithTotals = StickerbookSet & { total: number; collected: number };

const STATUS = [
  { key: "all", label: "All" },
  { key: "incomplete", label: "Incomplete" },
  { key: "complete", label: "Complete" },
] as const;

export function StickerbookGrid({ sets }: { sets: SetWithTotals[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS)[number]["key"]>("all");
  const [category, setCategory] = useState("");

  const categories = useMemo(() => Array.from(new Set(sets.map((s) => s.category))).sort(), [sets]);

  const filtered = useMemo(() => {
    return sets.filter((s) => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (category && s.category !== category) return false;
      const complete = s.total > 0 && s.collected === s.total;
      if (status === "complete" && !complete) return false;
      if (status === "incomplete" && complete) return false;
      return true;
    });
  }, [sets, search, status, category]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
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

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`rounded-lg border bg-surface py-2 pl-2.5 pr-7 text-sm focus:border-accent focus:outline-none ${
            category ? "border-accent/50 text-fg" : "border-border text-fg-muted"
          }`}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-3 text-sm text-fg-muted">{filtered.length} sets</div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface/70 px-6 py-12 text-center text-sm text-fg-muted">
          No sets match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <SetCard key={s.setId} set={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function SetCard({ set: s }: { set: SetWithTotals }) {
  const complete = s.total > 0 && s.collected === s.total;
  const entries = Object.entries(s.pieces);
  const pct = s.total > 0 ? Math.round((s.collected / s.total) * 100) : 0;

  return (
    <div
      className={`rounded-xl border bg-surface/70 p-4 transition-colors ${
        complete ? "border-accent/50" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium text-fg">{s.name}</div>
          <div className="mt-0.5 text-xs text-fg-subtle">{s.category}</div>
        </div>
        {complete ? (
          <span className="flex h-6 items-center gap-1 rounded-md border border-accent/40 bg-accent-soft px-1.5 text-xs text-accent">
            <Check className="h-3 w-3" /> Complete
          </span>
        ) : (
          <span className="text-xs text-fg-muted">
            {s.collected}/{s.total}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {entries.map(([slot, owned]) => (
          <span
            key={slot}
            title={`${slot}: ${owned ? "collected" : "missing"}`}
            className={`flex h-6 min-w-6 items-center justify-center rounded-md border px-1 text-[10px] font-medium ${
              owned
                ? "border-accent/40 bg-accent-soft text-accent"
                : "border-border/70 bg-surface-2 text-fg-subtle"
            }`}
          >
            {slotAbbrev(slot)}
          </span>
        ))}
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function slotAbbrev(slot: string): string {
  const map: Record<string, string> = {
    Head: "Hd",
    Chest: "Ch",
    Shoulders: "Sh",
    Hands: "Hn",
    Waist: "Ws",
    Legs: "Lg",
    Feet: "Ft",
    Necklace: "Nk",
    Ring: "Rg",
    Weapon: "Wp",
  };
  return map[slot] ?? slot.slice(0, 2);
}
