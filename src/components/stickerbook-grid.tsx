"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronRight, Minus, Search } from "lucide-react";
import type { StickerbookSet } from "@/lib/snapshot/schema";
import { GameIcon } from "./game-icon";

type SetWithTotals = StickerbookSet & { total: number; collected: number; href?: string };

const STATUS = [
  { key: "all", label: "All" },
  { key: "incomplete", label: "Incomplete" },
  { key: "complete", label: "Complete" },
] as const;

type Status = (typeof STATUS)[number]["key"];

interface SubNode {
  name: string;
  order: number;
  collected: number;
  total: number;
}
interface ParentNode {
  name: string;
  order: number;
  collected: number;
  total: number;
  subs: SubNode[];
}

export function StickerbookGrid({ sets }: { sets: SetWithTotals[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<Status>("all");
  const [parent, setParent] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Build the in-game two-level tree (category -> subcategory) in game order.
  const tree = useMemo<ParentNode[]>(() => {
    const parents = new Map<string, ParentNode & { subMap: Map<string, SubNode> }>();
    for (const s of sets) {
      const pName = s.category || "Unknown";
      const p =
        parents.get(pName) ??
        (() => {
          const node = { name: pName, order: s.categoryOrder ?? 0, collected: 0, total: 0, subs: [], subMap: new Map() };
          parents.set(pName, node);
          return node;
        })();
      p.collected += s.collected;
      p.total += s.total;
      p.order = Math.min(p.order || s.categoryOrder || 0, s.categoryOrder || 0) || p.order;

      const subName = s.subcategory;
      if (subName) {
        const sn =
          p.subMap.get(subName) ?? { name: subName, order: s.subOrder ?? 0, collected: 0, total: 0 };
        sn.collected += s.collected;
        sn.total += s.total;
        p.subMap.set(subName, sn);
      }
    }
    const arr = Array.from(parents.values()).map((p) => ({
      name: p.name,
      order: p.order,
      collected: p.collected,
      total: p.total,
      subs: Array.from(p.subMap.values()).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name)),
    }));
    return arr.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }, [sets]);

  const grand = useMemo(
    () => sets.reduce((a, s) => ({ collected: a.collected + s.collected, total: a.total + s.total }), {
      collected: 0,
      total: 0,
    }),
    [sets],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return sets.filter((s) => {
      if (parent && (s.category || "Unknown") !== parent) return false;
      if (sub && s.subcategory !== sub) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      const complete = s.total > 0 && s.collected === s.total;
      if (status === "complete" && !complete) return false;
      if (status === "incomplete" && complete) return false;
      return true;
    });
  }, [sets, search, status, parent, sub]);

  function selectAll() {
    setParent(null);
    setSub(null);
  }
  function selectParent(name: string) {
    setParent(name);
    setSub(null);
    setExpanded((e) => new Set(e).add(name));
  }
  function toggleExpand(name: string) {
    setExpanded((e) => {
      const next = new Set(e);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const heading =
    sub ?? parent ?? "All Sets";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      {/* Category tree has its own scroll; it never overlays the set cards. */}
      <aside className="max-h-[36vh] shrink-0 overflow-y-auto bg-bg pr-1 lg:max-h-none lg:min-h-0 lg:w-64 lg:self-stretch">
          <button
            onClick={selectAll}
            className={`mb-1 flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
              !parent
                ? "border-accent/50 bg-accent-soft text-fg"
                : "border-border bg-surface/70 text-fg-muted hover:text-fg"
            }`}
          >
            <span className="font-medium">All Sets</span>
            <span className={`text-xs ${!parent ? "text-accent" : "text-fg-subtle"}`}>
              {grand.collected}/{grand.total}
            </span>
          </button>

          {tree.map((p) => {
            const isOpen = expanded.has(p.name);
            const parentActive = parent === p.name && !sub;
            const done = p.total > 0 && p.collected === p.total;
            return (
              <div key={p.name} className="mb-0.5">
                <div
                  className={`flex items-center gap-1 rounded-lg border px-1 transition-colors ${
                    parentActive ? "border-accent/50 bg-accent-soft" : "border-transparent hover:bg-surface-2/50"
                  }`}
                >
                  {p.subs.length > 0 ? (
                    <button
                      onClick={() => toggleExpand(p.name)}
                      aria-label={isOpen ? "Collapse" : "Expand"}
                      className="flex h-6 w-6 shrink-0 items-center justify-center text-fg-subtle hover:text-fg"
                    >
                      <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                    </button>
                  ) : (
                    <span className="h-6 w-6 shrink-0" />
                  )}
                  <button
                    onClick={() => selectParent(p.name)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 py-2 text-left text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {done && <Check className="h-3.5 w-3.5 shrink-0 text-accent" />}
                      <span className={`truncate font-medium ${parentActive ? "text-fg" : "text-fg-muted"}`}>
                        {p.name}
                      </span>
                    </span>
                    <span className={`shrink-0 text-xs ${parentActive ? "text-accent" : "text-fg-subtle"}`}>
                      {p.collected}/{p.total}
                    </span>
                  </button>
                </div>

                {isOpen &&
                  p.subs.map((sn) => {
                    const active = sub === sn.name;
                    const subDone = sn.total > 0 && sn.collected === sn.total;
                    return (
                      <button
                        key={sn.name}
                        onClick={() => {
                          setParent(p.name);
                          setSub(sn.name);
                        }}
                        className={`ml-7 flex w-[calc(100%-1.75rem)] items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                          active ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-surface-2/50 hover:text-fg"
                        }`}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          {subDone && <Check className="h-3 w-3 shrink-0 text-accent" />}
                          <span className="truncate">{sn.name}</span>
                        </span>
                        <span className={`shrink-0 text-xs ${active ? "text-accent" : "text-fg-subtle"}`}>
                          {sn.collected}/{sn.total}
                        </span>
                      </button>
                    );
                  })}
              </div>
            );
          })}
      </aside>

      {/* Sets — search stays put; only the card list scrolls. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2 bg-bg pb-3">
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

        <div className="mb-3 flex shrink-0 items-center gap-2 text-sm">
          <span className="font-medium text-fg">{heading}</span>
          <span className="text-fg-subtle">
            · {filtered.length} {filtered.length === 1 ? "set" : "sets"}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
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
    </div>
  );
}

// Older snapshots stored a meaningless slot code (e.g. "Slot 1.97e-3"); never
// show that.
const SLOT_CODE = /^slot\s+[-\d.eE+]+$/i;

/**
 * The label for one collected/missing piece.
 *
 * The game gives us the real item name for many sets ("Helm of the Veiled
 * Heritance", "Slimecraw Helmet"). For others — Infinite Archive and similar —
 * the collection API returns only the slot ("Hat", "Helmet"), so the snapshot
 * stored that slot as the name. We do NOT want half the sets showing full item
 * names and half showing a bare slot, so when only a slot is known we compose
 * the item's real name the way ESO names those pieces: "<Set> <Slot>"
 * (e.g. "Aerie's Cry Helmet"). Set name and slot are both real in-game strings;
 * nothing is invented.
 */
function pieceLabel(p: { name?: string; type?: string; slot?: string }, setName: string): string {
  const clean = (v?: string) => {
    const t = (v ?? "").trim();
    return !t || SLOT_CODE.test(t) ? "" : t;
  };
  const name = clean(p.name);
  const slot = clean(p.slot);
  const type = clean(p.type);

  // A genuine item name is more than just the slot label the game fell back to.
  const isBareSlot = !name || name === slot || name === type;
  if (!isBareSlot) return name;

  const slotWord = slot || type;
  if (!slotWord) return name || "Piece";
  // Do not double the set name if the slot label already carries it.
  if (slotWord.toLowerCase().includes(setName.trim().toLowerCase())) return slotWord;
  return `${setName} ${slotWord}`;
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
          <div className="mt-0.5 text-xs text-fg-subtle">{s.subcategory ?? s.category}</div>
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
          const label = pieceLabel(p, s.name);
          return (
            <span
              key={`${p.slot}-${i}`}
              title={`${p.name || label || "Piece"}${p.type && p.type !== p.name ? ` · ${p.type}` : ""} · ${
                p.collected ? "collected" : "missing"
              }`}
              className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-xs ${
                p.collected
                  ? "border-accent/40 bg-accent-soft text-fg"
                  : "border-border/70 bg-surface-2/50 text-fg-subtle"
              }`}
            >
              <span className={`relative shrink-0 ${p.collected ? "" : "opacity-40 grayscale"}`}>
                <GameIcon name={label || p.name || "?"} icon={p.icon} size={22} />
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
