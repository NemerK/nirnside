"use client";

import { useMemo, useState } from "react";
import { Check, Minus, Search, Trophy } from "lucide-react";
import {
  PITHKA_TABS,
  allTrackedIds,
  type PithkaInstance,
  type PithkaTab,
} from "@/lib/achievements/pithka";

type Filter = "all" | "done" | "todo";

/** A rendered column, driven off the Pithka fields for the active tab. */
type Col =
  | { kind: "check"; field: CheckField; label: string; tip?: string }
  | { kind: "named"; id: NamedField; name: NameField; label: string }
  | { kind: "chaTri"; label: string };

type CheckField = "vet" | "hm" | "sr" | "nd";
type NamedField = "phm1" | "phm2" | "hm" | "tri" | "ext";
type NameField = "phm1Name" | "phm2Name" | "hmName" | "triName" | "extName";

const COLUMNS: Record<PithkaTab, Col[]> = {
  Trials: [
    { kind: "check", field: "vet", label: "Vet", tip: "Veteran clear" },
    { kind: "named", id: "phm1", name: "phm1Name", label: "Partial HM" },
    { kind: "named", id: "phm2", name: "phm2Name", label: "Partial HM" },
    { kind: "named", id: "hm", name: "hmName", label: "Hard Mode" },
    { kind: "named", id: "tri", name: "triName", label: "Trifecta" },
    { kind: "named", id: "ext", name: "extName", label: "Extra" },
  ],
  "Trifecta Dungeons": [
    { kind: "check", field: "vet", label: "Vet", tip: "Veteran clear" },
    { kind: "check", field: "hm", label: "HM", tip: "Hard Mode" },
    { kind: "check", field: "sr", label: "SR", tip: "Speed Run" },
    { kind: "check", field: "nd", label: "ND", tip: "No Death" },
    { kind: "chaTri", label: "Challenger & Trifecta" },
    { kind: "named", id: "ext", name: "extName", label: "Extras" },
  ],
  Arenas: [
    { kind: "check", field: "vet", label: "Vet", tip: "Veteran clear" },
    { kind: "check", field: "hm", label: "HM", tip: "Hard Mode" },
    { kind: "check", field: "sr", label: "SR", tip: "Speed Run" },
    { kind: "check", field: "nd", label: "ND", tip: "No Death" },
    { kind: "named", id: "tri", name: "triName", label: "Trifecta" },
    { kind: "named", id: "ext", name: "extName", label: "Extra" },
  ],
  "Base Dungeons": [
    { kind: "check", field: "vet", label: "Vet", tip: "Veteran clear" },
    { kind: "check", field: "hm", label: "HM", tip: "Hard Mode" },
    { kind: "check", field: "sr", label: "SR", tip: "Speed Run" },
    { kind: "check", field: "nd", label: "ND", tip: "No Death" },
  ],
};

const ROW_LABEL: Record<PithkaTab, string> = {
  Trials: "Trial",
  "Trifecta Dungeons": "Dungeon",
  Arenas: "Arena",
  "Base Dungeons": "Dungeon",
};

export function AchievementsBoard({ completedIds }: { completedIds: number[] }) {
  const done = useMemo(() => new Set(completedIds), [completedIds]);
  const [tab, setTab] = useState<PithkaTab>("Trials");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const rows = useMemo(() => PITHKA_TABS.find((t) => t.id === tab)!.rows, [tab]);
  const cols = COLUMNS[tab];

  const rowIsDone = (r: PithkaInstance) => {
    const ids = allTrackedIds([r]);
    return ids.length > 0 && ids.every((id) => done.has(id));
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (filter === "done" && !rowIsDone(r)) return false;
      if (filter === "todo" && rowIsDone(r)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, filter, done]);

  const summary = useMemo(() => {
    const ids = allTrackedIds(rows);
    const earned = ids.filter((id) => done.has(id)).length;
    const triIds = rows.map((r) => r.tri).filter((v): v is number => typeof v === "number");
    const triDone = triIds.filter((id) => done.has(id)).length;
    return { earned, total: ids.length, triDone, triTotal: triIds.length };
  }, [rows, done]);

  return (
    <div>
      {/* Tabs — one per Pithka window. */}
      <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-border">
        {PITHKA_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "border-accent text-fg" : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            {t.id}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${tab.toLowerCase()}…`}
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
          />
        </div>
        <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
          {(
            [
              ["all", "All"],
              ["done", "Done"],
              ["todo", "Not done"],
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
        <div className="text-sm text-fg-muted">
          {summary.earned}/{summary.total} done
          {summary.triTotal > 0 && (
            <>
              {" · "}
              {summary.triDone}/{summary.triTotal} trifectas
            </>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2/40 text-left text-xs uppercase tracking-wider text-fg-subtle">
              <th className="sticky left-0 z-10 bg-surface-2/40 px-3 py-2 font-medium">{ROW_LABEL[tab]}</th>
              {cols.map((c, i) => (
                <th
                  key={i}
                  title={c.kind === "check" ? c.tip : undefined}
                  className={`px-3 py-2 font-medium ${c.kind === "check" ? "text-center" : "text-left"}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.abbv} className="border-b border-border/50 align-middle last:border-0 hover:bg-surface-2/30">
                <td className="sticky left-0 z-10 bg-surface px-3 py-1 font-medium text-fg">{r.name}</td>
                {cols.map((c, i) => (
                  <td key={i} className={`px-3 py-1 ${c.kind === "check" ? "text-center" : ""}`}>
                    {c.kind === "check" && <CheckCell id={r[c.field]} done={done} />}
                    {c.kind === "named" && (
                      <NamedCell id={r[c.id]} name={(r[c.name] as string | undefined) ?? ""} done={done} />
                    )}
                    {c.kind === "chaTri" && <ChaTriCell row={r} done={done} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-border bg-surface/70 px-6 py-10 text-sm text-fg-muted">
          <Trophy className="h-4 w-4" /> Nothing matches these filters.
        </div>
      )}

      <p className="mt-3 text-xs text-fg-subtle">
        Every instance and achievement matches the in-game Pithka tracker exactly; a green check means done, a dash means
        not yet. A blank cell means that challenge doesn&apos;t exist for that instance.
      </p>
    </div>
  );
}

/** A compact challenge column: check (done) / dash (not) / blank (n/a). */
function CheckCell({ id, done }: { id?: number | null; done: Set<number> }) {
  if (typeof id !== "number") return <span className="text-fg-subtle/25">·</span>;
  return done.has(id) ? (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-ok/40 bg-ok/10 text-ok">
      <Check className="h-3 w-3" />
    </span>
  ) : (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-border/70 text-fg-subtle/60">
      <Minus className="h-3 w-3" />
    </span>
  );
}

/** A named achievement: its unique name + done/not-done, or blank if n/a. */
function NamedCell({ id, name, done }: { id?: number | null; name: string; done: Set<number> }) {
  if (typeof id !== "number") return <span className="text-fg-subtle/25">—</span>;
  const isDone = done.has(id);
  return (
    <span
      title={`${name || "Achievement"} — ${isDone ? "done" : "not done"}`}
      className={`inline-flex max-w-[16rem] items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs ${
        isDone ? "border-ok/40 bg-ok/10 text-fg" : "border-border/60 bg-surface-2/40 text-fg-subtle"
      }`}
    >
      {isDone ? (
        <Check className="h-3 w-3 shrink-0 text-ok" />
      ) : (
        <Minus className="h-3 w-3 shrink-0 text-fg-subtle/60" />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}

/** Dungeon "Challenger & Trifecta": the Challenger check plus the named Trifecta. */
function ChaTriCell({ row, done }: { row: PithkaInstance; done: Set<number> }) {
  return (
    <div className="flex items-center gap-2">
      {typeof row.cha === "number" && (
        <span title={`Challenger — ${done.has(row.cha) ? "done" : "not done"}`}>
          <CheckCell id={row.cha} done={done} />
        </span>
      )}
      <NamedCell id={row.tri} name={row.triName ?? ""} done={done} />
    </div>
  );
}
