"use client";

import { useMemo, useState } from "react";
import { Check, Minus, Search, Trophy } from "lucide-react";
import type { CatalogSource } from "@/lib/catalog/schema";

const COLS = ["Completion", "Hard Mode", "Trifecta"] as const;
type Col = (typeof COLS)[number];

export interface AchievementCell {
  name: string;
  earned: boolean;
}
export interface ContentRow {
  content: string;
  category: string;
  source: CatalogSource;
  cells: Partial<Record<Col, AchievementCell>>;
}

export function AchievementsBoard({ rows }: { rows: ContentRow[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [only, setOnly] = useState<"all" | "earned" | "missing">("all");

  const categories = useMemo(() => Array.from(new Set(rows.map((r) => r.category))).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (q && !r.content.toLowerCase().includes(q)) return false;
      if (category && r.category !== category) return false;
      const cells = Object.values(r.cells);
      const anyEarned = cells.some((c) => c?.earned);
      const allEarned = cells.length > 0 && cells.every((c) => c?.earned);
      if (only === "earned" && !anyEarned) return false;
      if (only === "missing" && allEarned) return false;
      return true;
    });
  }, [rows, search, category, only]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trials, dungeons, arenas…"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
          />
        </div>
        <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
          {(["all", "earned", "missing"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setOnly(k)}
              className={`rounded-md px-2.5 py-1.5 text-sm capitalize transition-colors ${
                only === k ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"
              }`}
            >
              {k}
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
          <option value="">All content</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-fg-subtle">
              <th className="px-4 py-2.5 font-medium">Content</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              {COLS.map((c) => (
                <th key={c} className="px-3 py-2.5 text-center font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.content} className="border-b border-border/50 last:border-0 hover:bg-surface-2/40">
                <td className="px-4 py-2.5 font-medium text-fg">{r.content}</td>
                <td className="px-3 py-2.5 text-fg-muted">{r.category}</td>
                {COLS.map((col) => {
                  const cell = r.cells[col];
                  return (
                    <td key={col} className="px-3 py-2.5 text-center">
                      {!cell ? (
                        <span className="text-fg-subtle/40">·</span>
                      ) : cell.earned ? (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-accent/40 bg-accent-soft text-accent" title={cell.name}>
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/70 text-fg-subtle" title={`${cell.name} — not earned`}>
                          <Minus className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-border bg-surface/70 px-6 py-10 text-sm text-fg-muted">
          <Trophy className="h-4 w-4" /> No content matches these filters.
        </div>
      )}
    </div>
  );
}
