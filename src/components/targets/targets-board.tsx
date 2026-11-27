"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Pencil, X } from "lucide-react";
import { classColor } from "@/lib/classes";
import { TIER_COLOR, TIER_LABEL, TIERS, type Goal, type GoalScope, type GoalTier } from "@/lib/goals/types";
import type { ReviewGroup } from "@/lib/goals/review";
import { buildMatrix, cellProgress, cellText, isOpenMark, type MatrixCell, type MatrixRow } from "@/lib/goals/matrix";
import { TargetSheet, type Audience, type TargetPerson, type TargetSubject } from "./target-sheet";


type Show = "open" | "all";

function Dot({ tier }: { tier: GoalTier }) {
  return <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TIER_COLOR[tier] }} aria-hidden />;
}

/** One character's result for one row. */
function Cell({
  cell,
  person,
  rowTier,
  focused,
  onEdit,
}: {
  cell: MatrixCell | undefined;
  person: TargetPerson;
  rowTier: GoalTier;
  focused: boolean;
  onEdit: () => void;
}) {
  const base = `relative h-8 w-full border-b border-border/40 text-[12px] tabular-nums ${focused ? "bg-accent-soft" : ""}`;
  if (!cell) {
    return (
      <td className={base} title={`No target covers ${person.name}`}>
        <span className="block text-center text-fg-subtle/40" aria-label="No target">
          ·
        </span>
      </td>
    );
  }
  const { mark } = cell;
  const done = mark.state === "done";
  const open = isOpenMark(mark);
  const p = cellProgress(cell);
  return (
    <td className={base}>
      <button
        type="button"
        onClick={onEdit}
        title={`${person.name}: ${mark.label}\n${TIER_LABEL[cell.tier]} target${mark.reason ? ` (${mark.reason})` : ""}\nClick to change the target that covers ${person.name}`}
        className="group absolute inset-0 flex flex-col items-center justify-center rounded-md hover:bg-surface-2"
      >
        {done ? (
          <Check className="h-3 w-3 text-ok opacity-45 group-hover:opacity-100" aria-label="Met" />
        ) : (
          <span className={mark.state === "undiscovered" ? "text-fg-subtle" : open ? "text-fg" : "text-fg-subtle"}>
            {cellText(cell)}
          </span>
        )}
        {open && mark.state === "short" ? (
          <span className="absolute inset-x-2 bottom-1 h-[2px] rounded-full bg-meter-track" aria-hidden>
            <span className="block h-full rounded-full" style={{ width: `${Math.round(p * 100)}%`, background: TIER_COLOR[cell.tier] }} />
          </span>
        ) : null}
        {open && cell.tier !== rowTier ? (
          <span className="absolute right-1 top-1">
            <Dot tier={cell.tier} />
          </span>
        ) : null}
      </button>
    </td>
  );
}

/** "Everyone · 10", or "Everyone 10 · Heimdall 20" when targets differ by audience. */
function rowDetail(row: MatrixRow): string {
  return row.targets
    .map((t) => {
      const g = t.goal;
      const rank =
        g.domain === "skillline"
          ? g.targetRank > 0 && (g.extraRank ?? 0) > g.targetRank
            ? `${g.targetRank}–${g.extraRank}`
            : String(g.targetRank || g.extraRank || "")
          : "";
      return [t.audience, rank].filter(Boolean).join(" ");
    })
    .join(" · ");
}

export function TargetsBoard({
  groups,
  goals,
  people,
  roles,
  choices,
}: {
  groups: ReviewGroup[];
  goals: Goal[];
  people: TargetPerson[];
  roles: { id: string; name: string }[];
  choices: TargetSubject[];
}) {
  const [show, setShow] = useState<Show>("open");
  const [focus, setFocus] = useState<string>("");
  const [sheet, setSheet] = useState<{ subject: TargetSubject | null; audience: Audience } | null>(null);

  const rows = useMemo(() => buildMatrix(groups), [groups]);
  const met = rows.filter((r) => r.complete).length;

  // Per character: how many mandatory targets are still open.
  const left = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows)
      for (const [id, c] of r.cells) if (c.tier === "essential" && isOpenMark(c.mark)) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [rows]);

  function subjectFor(goal: Goal): TargetSubject {
    return (
      choices.find((c) => c.domain === goal.domain && c.name.toLowerCase() === goal.target.toLowerCase()) ?? {
        domain: goal.domain,
        name: goal.target,
        cap: null,
        className: null,
        context: "",
      }
    );
  }
  const editGoal = (goal: Goal) =>
    setSheet({
      subject: subjectFor(goal),
      audience: { scope: goal.scope as GoalScope, characterId: goal.characterId, scopeKey: goal.scopeKey },
    });

  const visible = rows.filter((r) => {
    if (focus) {
      const c = r.cells.get(focus);
      return !!c && (show === "all" || isOpenMark(c.mark));
    }
    return show === "all" || !r.complete;
  });
  const focusPerson = people.find((p) => p.id === focus);

  const seg = (value: Show, label: string) => (
    <button
      type="button"
      onClick={() => setShow(value)}
      aria-pressed={show === value}
      className={`rounded-md px-2.5 py-1 text-[13px] ${show === value ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"}`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Show">
          {seg("open", "Still to do")}
          {seg("all", "Everything")}
        </div>
        {focusPerson ? (
          <button
            type="button"
            onClick={() => setFocus("")}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2.5 py-1 text-[13px] text-fg"
          >
            Only {focusPerson.name} <X className="h-3.5 w-3.5 text-fg-muted" aria-label="Show everyone" />
          </button>
        ) : null}
        <span className="text-[13px] text-fg-subtle">
          {met} of {rows.length} met by everyone
        </span>
        <button
          type="button"
          onClick={() =>
            setSheet({
              subject: null,
              audience: focus
                ? { scope: "character", characterId: focus, scopeKey: null }
                : { scope: "account", characterId: null, scopeKey: null },
            })
          }
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit targets
        </button>
      </div>

      <p className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-fg-subtle">
        {TIERS.map((tier) => (
          <span key={tier} className="inline-flex items-center gap-1.5">
            <Dot tier={tier} />
            {TIER_LABEL[tier]}
          </span>
        ))}
        <span>— not discovered</span>
        <span>· no target</span>
        <span>Click a name to change a target, a cell to change it for that character, a column to focus on one character.</span>
      </p>

      {rows.length === 0 ? (
        <div className="party-module px-6 py-12 text-center">
          <h2 className="font-display text-2xl text-fg">No targets yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
            A target is something to work towards: a skill line rank, an ability, a scribing script. Set it for
            everyone, a class, a role or one character with Edit targets, or straight from the{" "}
            <Link href="/party/characters?view=skills" className="text-accent hover:underline">
              skill line grid
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="party-module overflow-x-auto p-0">
          {/* Fixed columns: every character gets the same width and the grid
              keeps to the left, so 13 characters leave room for 20 later. */}
          <table
            className="table-fixed border-separate border-spacing-0"
            style={{ width: `calc(16rem + ${people.length} * 3.5rem)` }}
          >
            <colgroup>
              <col style={{ width: "16rem" }} />
              {people.map((p) => (
                <col key={p.id} style={{ width: "3.5rem" }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 border-b border-border bg-surface px-4 pb-2 text-left align-bottom text-[12px] font-normal text-fg-subtle">
                  {visible.length} {visible.length === 1 ? "target" : "targets"}
                </th>
                {people.map((p) => {
                  const active = focus === p.id;
                  const n = left.get(p.id) ?? 0;
                  return (
                    <th key={p.id} className={`border-b border-border px-0.5 pb-2 align-bottom font-normal ${active ? "bg-accent-soft" : ""}`}>
                      <button
                        type="button"
                        onClick={() => setFocus(active ? "" : p.id)}
                        aria-pressed={active}
                        title={`${p.name} · ${p.className}\n${n === 0 ? "Every mandatory target met" : `${n} mandatory left`}\nClick to show only ${p.name}`}
                        className="mx-auto flex flex-col items-center gap-1.5 rounded-md px-1 pt-1 hover:bg-surface-2"
                      >
                        <span
                          className="max-h-32 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-fg [writing-mode:vertical-rl] rotate-180"
                        >
                          {p.name}
                        </span>
                        <span className="h-1 w-5 rounded-full" style={{ background: classColor(p.className) ?? "var(--border)" }} aria-hidden />
                        <span className={`text-[11px] tabular-nums ${n === 0 ? "text-ok" : "text-fg-muted"}`}>
                          {n === 0 ? <Check className="h-3 w-3" aria-label="Mandatory met" /> : n}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {TIERS.map((tier) => {
                const list = visible.filter((r) => r.tier === tier);
                if (list.length === 0) return null;
                const openRows = list.filter((r) => !r.complete).length;
                return (
                  <Fragment key={tier}>
                    <tr>
                      <th
                        colSpan={people.length + 1}
                        className="sticky left-0 border-b border-border/60 bg-surface-2/40 px-4 py-1.5 text-left text-[12px] font-normal"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Dot tier={tier} />
                          <span className="text-fg">{TIER_LABEL[tier]}</span>
                          <span className="text-fg-subtle">{openRows === 0 ? "all met" : `${openRows} with work left`}</span>
                        </span>
                      </th>
                    </tr>
                    {list.map((r) => (
                      <tr key={r.key} className="group/row hover:bg-surface-2/30">
                        <th
                          scope="row"
                          className="sticky left-0 z-10 border-b border-border/40 bg-surface px-4 py-0.5 text-left font-normal group-hover/row:bg-surface-2"
                        >
                          <button type="button" onClick={() => editGoal(r.targets[0].goal)} className="block w-full text-left">
                            <span className={`block truncate text-[13px] leading-snug hover:text-accent ${r.complete ? "text-fg-muted" : "text-fg"}`}>
                              {r.name}
                            </span>
                            <span className="block truncate text-[11px] leading-tight text-fg-subtle">{rowDetail(r)}</span>
                          </button>
                        </th>
                        {people.map((p) => {
                          const cell = r.cells.get(p.id);
                          return (
                            <Cell
                              key={p.id}
                              cell={cell}
                              person={p}
                              rowTier={r.tier}
                              focused={focus === p.id}
                              onEdit={() => cell && editGoal(cell.goal)}
                            />
                          );
                        })}
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={people.length + 1} className="px-4 py-8 text-center text-[13px] text-ok">
                    <Check className="mr-1.5 inline h-4 w-4" />
                    {focusPerson ? `${focusPerson.name} has met every target.` : "Every target is met by everyone."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {show === "open" && !focus && met > 0 ? (
            <button
              type="button"
              onClick={() => setShow("all")}
              className="w-full border-t border-border/60 px-4 py-2 text-left text-[12px] text-fg-subtle hover:text-fg"
            >
              {met} {met === 1 ? "target is" : "targets are"} met by everyone. Show them
            </button>
          ) : null}
        </div>
      )}

      {sheet ? (
        <TargetSheet
          subject={sheet.subject}
          choices={choices}
          people={people}
          roles={roles}
          goals={goals}
          initial={sheet.audience}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </div>
  );
}
