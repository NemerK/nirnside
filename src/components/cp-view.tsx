"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";

export interface CPStarLite {
  id: string;
  name: string;
  type: "slottable" | "passive" | "cluster";
  description: string;
  maxPoints: number;
}
export interface CPDiscipline {
  name: string;
  stars: CPStarLite[];
}
export interface CPCharacterAlloc {
  id: string;
  name: string;
  alloc: Record<string, { points: number; slotted: boolean }>; // keyed by star name (lowercase)
}

const TREE_ACCENT: Record<string, string> = {
  Warfare: "#4a86d6",
  Fitness: "#4bb06a",
  Craft: "#d6743a",
};

export function CPView({
  disciplines,
  characters,
}: {
  disciplines: CPDiscipline[];
  characters: CPCharacterAlloc[];
}) {
  const [tab, setTab] = useState<"tree" | "planner">("tree");

  return (
    <div>
      <div className="sticky top-0 z-20 mb-5 inline-flex rounded-lg border border-border bg-bg/90 p-0.5 backdrop-blur-md">
        {(["tree", "planner"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${
              tab === t ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"
            }`}
          >
            {t === "tree" ? "Tree & overlay" : "Planner"}
          </button>
        ))}
      </div>

      {tab === "tree" ? (
        <Tree disciplines={disciplines} characters={characters} />
      ) : (
        <Planner disciplines={disciplines} characters={characters} />
      )}
    </div>
  );
}

function Tree({ disciplines, characters }: { disciplines: CPDiscipline[]; characters: CPCharacterAlloc[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {disciplines.map((disc) => (
        <div key={disc.name}>
          <div className="mb-2 flex items-center gap-2">
            <Star className="h-4 w-4" style={{ color: TREE_ACCENT[disc.name] ?? "var(--accent)" }} />
            <h3 className="font-medium text-fg">{disc.name}</h3>
          </div>
          <div className="space-y-2">
            {disc.stars.map((s) => {
              const investedBy = characters.filter((c) => (c.alloc[s.name.toLowerCase()]?.points ?? 0) > 0);
              return (
                <div key={s.id} className="rounded-lg border border-border bg-surface/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-fg">{s.name}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                        s.type === "slottable" ? "bg-accent-soft text-accent" : "bg-surface-2 text-fg-subtle"
                      }`}
                    >
                      {s.type}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-fg-muted">{s.description}</p>
                  {investedBy.length > 0 && (
                    <div className="mt-1.5 text-[11px] text-fg-subtle">
                      Invested by {investedBy.map((c) => `${c.name} (${c.alloc[s.name.toLowerCase()].points})`).join(", ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Planner({ disciplines, characters }: { disciplines: CPDiscipline[]; characters: CPCharacterAlloc[] }) {
  const [budget, setBudget] = useState(3600);
  const [fromChar, setFromChar] = useState("");
  const [alloc, setAlloc] = useState<Record<string, number>>({});

  const loadFrom = (charId: string) => {
    setFromChar(charId);
    const c = characters.find((x) => x.id === charId);
    if (!c) {
      setAlloc({});
      return;
    }
    const next: Record<string, number> = {};
    for (const disc of disciplines) {
      for (const s of disc.stars) {
        const a = c.alloc[s.name.toLowerCase()];
        if (a?.points) next[s.id] = Math.min(a.points, s.maxPoints);
      }
    }
    setAlloc(next);
  };

  const spent = useMemo(() => Object.values(alloc).reduce((a, b) => a + b, 0), [alloc]);
  const perTree = useMemo(() => {
    const m: Record<string, number> = {};
    for (const disc of disciplines) {
      m[disc.name] = disc.stars.reduce((sum, s) => sum + (alloc[s.id] ?? 0), 0);
    }
    return m;
  }, [alloc, disciplines]);
  const remaining = budget - spent;

  const setPoints = (star: CPStarLite, value: number) => {
    const v = Math.max(0, Math.min(value, star.maxPoints));
    setAlloc((prev) => {
      const next = { ...prev };
      if (v === 0) delete next[star.id];
      else next[star.id] = v;
      return next;
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface/70 p-4">
        <label className="text-sm text-fg-muted">
          Budget{" "}
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))}
            className="ml-1 w-24 rounded border border-border bg-surface px-2 py-1 text-sm text-fg focus:border-accent focus:outline-none"
          />
        </label>
        <label className="text-sm text-fg-muted">
          Start from{" "}
          <select
            value={fromChar}
            onChange={(e) => loadFrom(e.target.value)}
            className="ml-1 rounded border border-border bg-surface px-2 py-1 text-sm text-fg focus:border-accent focus:outline-none"
          >
            <option value="">Empty</option>
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => {
            setAlloc({});
            setFromChar("");
          }}
          className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-fg-muted hover:text-fg"
        >
          Reset
        </button>
        <div className="ml-auto flex items-center gap-4 text-sm">
          <span className="text-fg-muted">
            Spent <span className="font-semibold text-fg">{spent.toLocaleString("en-US")}</span>
          </span>
          <span className={remaining < 0 ? "text-danger" : "text-ok"}>
            {remaining < 0 ? `Over by ${(-remaining).toLocaleString("en-US")}` : `${remaining.toLocaleString("en-US")} left`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {disciplines.map((disc) => (
          <div key={disc.name}>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4" style={{ color: TREE_ACCENT[disc.name] ?? "var(--accent)" }} />
                <h3 className="font-medium text-fg">{disc.name}</h3>
              </div>
              <span className="text-xs text-fg-subtle">{perTree[disc.name] ?? 0} pts</span>
            </div>
            <div className="space-y-2">
              {disc.stars.map((s) => {
                const value = alloc[s.id] ?? 0;
                return (
                  <div key={s.id} className="rounded-lg border border-border bg-surface/70 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-fg" title={s.description}>
                        {s.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setPoints(s, value - 10)}
                          className="h-6 w-6 rounded border border-border text-fg-muted hover:text-fg"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          value={value}
                          onChange={(e) => setPoints(s, Number(e.target.value) || 0)}
                          className="w-14 rounded border border-border bg-surface px-1.5 py-0.5 text-center text-sm text-fg focus:border-accent focus:outline-none"
                        />
                        <button
                          onClick={() => setPoints(s, value + 10)}
                          className="h-6 w-6 rounded border border-border text-fg-muted hover:text-fg"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-fg-subtle">
                      {s.type} · max {s.maxPoints}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
