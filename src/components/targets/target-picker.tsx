"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { classColor } from "@/lib/classes";
import { TIER_LABEL, type Goal, type GoalDomain } from "@/lib/goals/types";
import type { TargetSubject } from "./target-sheet";

/** The in-game skills window order; anything else follows alphabetically. */
const CATEGORY_ORDER = ["Class", "Weapon", "Armor", "World", "Guild", "Alliance War", "Racial", "Craft"];
const SCRIPT_ORDER = ["Focus script", "Signature script", "Affix script"];

type Tab = GoalDomain | "targeted";

const TABS: [Tab, string][] = [
  ["targeted", "Your targets"],
  ["skillline", "Skill lines"],
  ["ability", "Abilities"],
  ["script", "Scribing scripts"],
];

export const subjectKey = (c: Pick<TargetSubject, "domain" | "name">) => `${c.domain}|${c.name.trim().toLowerCase()}`;

function orderBy(order: string[]) {
  return (a: string, b: string) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
  };
}

/** Where a choice sits in the tree: category, then class (class lines only), then skill line (abilities only). */
function placeOf(c: TargetSubject) {
  const category = c.category ?? (c.domain === "script" ? c.context : "Other");
  return { category, cls: category === "Class" ? (c.className ?? "Other") : null, line: c.line ?? null };
}

interface Node {
  id: string;
  label: string;
  color?: string | null;
  count: number;
  targeted: number;
  children?: Node[];
}

/**
 * Pick what to target the way the game's skills window is laid out:
 * categories on the left (Class opens into classes, abilities open into
 * their skill line), the lines or abilities of the open one on the right.
 * Typing searches everything at once.
 */
export function TargetPicker({
  choices,
  goals,
  onPick,
}: {
  choices: TargetSubject[];
  goals: Goal[];
  onPick: (s: TargetSubject) => void;
}) {
  const targeted = useMemo(() => {
    const m = new Map<string, Goal[]>();
    for (const g of goals) m.set(subjectKey({ domain: g.domain, name: g.target }), [...(m.get(subjectKey({ domain: g.domain, name: g.target })) ?? []), g]);
    return m;
  }, [goals]);

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>(goals.length > 0 ? "targeted" : "skillline");
  const [path, setPath] = useState<string[]>([]);

  // The tree for the open tab: category → class → line, only as deep as the domain goes.
  const tree = useMemo<Node[]>(() => {
    if (tab === "targeted") return [];
    const mine = choices.filter((c) => c.domain === tab);
    const cats = new Map<string, TargetSubject[]>();
    for (const c of mine) {
      const { category } = placeOf(c);
      cats.set(category, [...(cats.get(category) ?? []), c]);
    }
    const tally = (list: TargetSubject[]) => ({
      count: list.length,
      targeted: list.filter((c) => targeted.has(subjectKey(c))).length,
    });
    const linesOf = (list: TargetSubject[], prefix: string): Node[] | undefined => {
      if (tab !== "ability") return undefined;
      const lines = new Map<string, TargetSubject[]>();
      for (const c of list) {
        const line = placeOf(c).line ?? "Other";
        lines.set(line, [...(lines.get(line) ?? []), c]);
      }
      return [...lines.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([line, l]) => ({ id: `${prefix}/${line}`, label: line, ...tally(l) }));
    };
    return [...cats.entries()]
      .sort((a, b) => orderBy(tab === "script" ? SCRIPT_ORDER : CATEGORY_ORDER)(a[0], b[0]))
      .map(([category, list]) => {
        if (category === "Class") {
          const classes = new Map<string, TargetSubject[]>();
          for (const c of list) {
            const cls = placeOf(c).cls ?? "Other";
            classes.set(cls, [...(classes.get(cls) ?? []), c]);
          }
          return {
            id: category,
            label: category,
            ...tally(list),
            children: [...classes.entries()]
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([cls, l]) => ({
                id: `${category}/${cls}`,
                label: cls,
                color: classColor(cls),
                ...tally(l),
                children: linesOf(l, `${category}/${cls}`),
              })),
          };
        }
        return { id: category, label: category, ...tally(list), children: linesOf(list, category) };
      });
  }, [choices, tab, targeted]);

  // Open the first leaf when nothing is chosen yet, so the right side is never empty.
  const firstLeaf = (nodes: Node[]): string[] => {
    const n = nodes[0];
    if (!n) return [];
    return [n.id, ...(n.children ? firstLeaf(n.children) : [])];
  };
  const openPath = path.length > 0 && tree.some((n) => n.id === path[0]) ? path : firstLeaf(tree);
  const leaf = openPath[openPath.length - 1] ?? "";

  function choose(node: Node, depth: number) {
    const base = openPath.slice(0, depth);
    setPath([...base, node.id, ...(node.children ? firstLeaf(node.children) : [])]);
  }

  const term = q.trim().toLowerCase();
  const shown = (() => {
    if (term) {
      return choices
        .filter((c) => c.name.toLowerCase().includes(term) || c.context.toLowerCase().includes(term))
        .sort((a, b) => Number(!a.name.toLowerCase().startsWith(term)) - Number(!b.name.toLowerCase().startsWith(term)) || a.name.localeCompare(b.name))
        .slice(0, 120);
    }
    if (tab === "targeted") return choices.filter((c) => targeted.has(subjectKey(c)));
    return choices.filter((c) => {
      if (c.domain !== tab) return false;
      const p = placeOf(c);
      const id = [p.category, p.cls, tab === "ability" ? (p.line ?? "Other") : null].filter(Boolean).join("/");
      return id === leaf;
    });
  })();

  const detail = (c: TargetSubject): string => {
    if (term || tab === "targeted") {
      const p = placeOf(c);
      return [p.cls ?? p.category, c.domain === "ability" ? p.line : null].filter(Boolean).join(" › ");
    }
    if (c.domain === "skillline") return c.cap ? `Rank ${c.cap}` : "";
    if (c.domain === "ability") return c.context.endsWith(" morph") ? c.context : "Base ability";
    return "";
  };

  const tags = (c: TargetSubject) => {
    const list = targeted.get(subjectKey(c));
    if (!list) return null;
    const tiers = [...new Set(list.map((g) => TIER_LABEL[g.tier]))].join(", ");
    return (
      <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-fg-muted">
        {list.length === 1 ? tiers : `${list.length} targets`}
      </span>
    );
  };

  const rail = (nodes: Node[], depth: number) => (
    <ul className={depth > 0 ? "ml-3 border-l border-border/70 pl-2" : "space-y-0.5"}>
      {nodes.map((n) => {
        const on = openPath[depth] === n.id;
        const isLeaf = !n.children;
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => choose(n, depth)}
              aria-current={on && isLeaf ? "true" : undefined}
              className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] ${
                on && isLeaf ? "bg-accent-soft text-fg" : on ? "text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              {n.children ? (
                <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-fg-subtle transition-transform ${on ? "rotate-90" : ""}`} />
              ) : null}
              {n.color ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: n.color }} aria-hidden /> : null}
              <span className="min-w-0 flex-1 truncate">{n.label}</span>
              {n.targeted > 0 ? (
                <span className="shrink-0 rounded bg-accent-soft px-1.5 text-[11px] tabular-nums text-fg-muted" title={`${n.targeted} targeted`}>
                  {n.targeted}
                </span>
              ) : null}
            </button>
            {on && n.children ? rail(n.children, depth + 1) : null}
          </li>
        );
      })}
    </ul>
  );

  const heading = term
    ? `Matching “${q.trim()}”`
    : tab === "targeted"
      ? "Everything you have a target for"
      : openPath.map((id) => id.split("/").pop()).join(" › ");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="What to target">
          {TABS.filter(([t]) => t !== "targeted" || goals.length > 0).map(([t, word]) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setPath([]);
                setQ("");
              }}
              aria-pressed={!term && tab === t}
              className={`rounded-md px-2.5 py-1 text-[13px] ${
                !term && tab === t ? "bg-accent-soft text-fg ring-1 ring-inset ring-accent/40" : "text-fg-muted hover:text-fg"
              }`}
            >
              {word}
            </button>
          ))}
        </div>
        <label className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search everything"
            aria-label="Search what to target"
            className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-border-strong focus:outline-none"
          />
        </label>
      </div>

      <div className={`grid min-h-0 flex-1 gap-4 ${!term && tab !== "targeted" ? "sm:grid-cols-[14rem_minmax(0,1fr)]" : ""}`}>
        {!term && tab !== "targeted" ? (
          <nav aria-label="Categories" className="min-h-0 overflow-y-auto pr-1">
            {rail(tree, 0)}
          </nav>
        ) : null}
        <div className="flex min-h-0 flex-col">
          <p className="mb-2 text-[13px] text-fg-muted">
            {heading} <span className="text-fg-subtle">· {shown.length}</span>
          </p>
          <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-1.5 overflow-y-auto pr-1 md:grid-cols-2">
            {shown.length === 0 ? <li className="py-6 text-center text-sm text-fg-muted md:col-span-2">Nothing matches.</li> : null}
            {shown.map((c) => (
              <li key={`${c.domain}-${c.className ?? ""}-${c.name}`}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left hover:border-border-strong hover:bg-surface-2 ${
                    targeted.has(subjectKey(c)) ? "border-accent/35 bg-accent-soft/40" : "border-border bg-surface"
                  }`}
                >
                  {c.className ? (
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: classColor(c.className) ?? "var(--fg-subtle)" }} aria-hidden />
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] text-fg">{c.name}</span>
                    {detail(c) ? <span className="block truncate text-[11.5px] text-fg-subtle">{detail(c)}</span> : null}
                  </span>
                  {tags(c)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
