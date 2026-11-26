"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { TIER_LABEL, type Goal, type GoalScope } from "@/lib/goals/types";
import type { ReviewGroup, ReviewPerson, ReviewTarget } from "@/lib/goals/review";
import { TargetSheet, type Audience, type TargetPerson, type TargetSubject } from "./target-sheet";

const STATE_TONE: Record<string, string> = {
  done: "text-ok",
  short: "text-fg",
  undiscovered: "text-fg-muted",
  unknown: "text-fg-subtle",
};

const STATE_DOT: Record<string, string> = {
  done: "var(--ok)",
  short: "var(--accent)",
  undiscovered: "var(--fg-subtle)",
  unknown: "transparent",
};

function Person({ p }: { p: ReviewPerson }) {
  return (
    <li className="flex min-w-0 items-center gap-2 text-[13px]">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{
          background: STATE_DOT[p.mark.state] ?? "transparent",
          boxShadow: p.mark.state === "unknown" ? "inset 0 0 0 1.5px var(--fg-subtle)" : undefined,
        }}
        aria-hidden
      />
      <Link href={`/characters/${p.id}`} className="truncate text-fg hover:text-accent">
        {p.name}
      </Link>
      <span className={`ml-auto shrink-0 tabular-nums ${STATE_TONE[p.mark.state] ?? "text-fg-muted"}`}>{p.mark.label}</span>
    </li>
  );
}

function Meter({ t }: { t: ReviewTarget }) {
  const pct = t.known > 0 ? (t.done / t.known) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 w-28 overflow-hidden rounded-full bg-meter-track">
        <div className={`h-full rounded-full ${t.complete ? "bg-ok" : "bg-meter"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="whitespace-nowrap text-[13px] tabular-nums text-fg-muted">
        {t.known > 0 ? (
          <>
            <span className="text-fg">{t.done}</span> of {t.known} done
          </>
        ) : (
          "Nobody snapshotted yet"
        )}
      </span>
    </div>
  );
}

function TargetCard({ t, onEdit, focus }: { t: ReviewTarget; onEdit: () => void; focus: string | null }) {
  const people = focus ? t.people.filter((p) => p.id === focus) : t.people;
  const [all, setAll] = useState(false);
  const shown = all ? people : people.slice(0, 8);
  return (
    <li className="panel px-5 py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={onEdit} className="min-w-0 text-left" title="Change this target">
          <span className="font-display text-xl font-semibold text-fg hover:text-accent">{t.title}</span>
        </button>
        {t.goal.domain !== "skillline" ? (
          <span className="rounded border border-border px-1.5 py-0.5 text-[12px] text-fg-muted">
            {TIER_LABEL[t.goal.tier]}
          </span>
        ) : null}
        <span className="text-[13px] text-fg-subtle">{t.audience}</span>
        <div className="ml-auto flex items-center gap-4">
          {!focus ? <Meter t={t} /> : null}
          <button type="button" onClick={onEdit} className="text-[13px] text-fg-muted hover:text-accent">
            Edit
          </button>
        </div>
      </div>
      {shown.length > 0 ? (
        <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <Person key={p.id} p={p} />
          ))}
        </ul>
      ) : null}
      {people.length > 8 && !all ? (
        <button type="button" onClick={() => setAll(true)} className="mt-2 text-[13px] text-fg-muted hover:text-fg">
          Show all {people.length}
        </button>
      ) : null}
      {!focus && t.overridden.length > 0 ? (
        <p className="mt-3 text-[13px] text-fg-subtle">
          {t.overridden.map((o, i) => (
            <span key={o.id}>
              {i > 0 ? "; " : null}
              {o.name} follows their own target ({o.by})
            </span>
          ))}
          .
        </p>
      ) : null}
    </li>
  );
}

type Show = "open" | "all";

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

  const visible = useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          targets: g.targets.filter((t) => {
            if (focus) {
              const mine = t.people.find((p) => p.id === focus);
              if (!mine) return false;
              return show === "all" || mine.mark.state !== "done";
            }
            return show === "all" || !t.complete;
          }),
        }))
        .filter((g) => g.targets.length > 0),
    [groups, show, focus],
  );
  const total = groups.reduce((n, g) => n + g.targets.length, 0);
  const finished = groups.reduce((n, g) => n + g.targets.filter((t) => t.complete).length, 0);

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

  const seg = (value: Show, label: string) => (
    <button
      type="button"
      onClick={() => setShow(value)}
      aria-pressed={show === value}
      className={`rounded-md px-2.5 py-1 text-[13px] ${
        show === value ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border bg-surface p-0.5">
          {seg("open", "Still to do")}
          {seg("all", "All targets")}
        </div>
        <select
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          aria-label="Show targets for"
          className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-fg"
        >
          <option value="">Every character</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="text-[13px] text-fg-subtle">
          {finished} of {total} {total === 1 ? "target" : "targets"} met
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
          <Plus className="h-4 w-4" /> New target
        </button>
      </div>

      {total === 0 ? (
        <div className="panel px-6 py-12 text-center">
          <h2 className="font-display text-2xl font-semibold text-fg">No targets yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
            A target is something to work towards — a skill line rank, an ability, a scribing script — for everyone, a
            class, a role or one character. The easiest place to set skill-line targets is the{" "}
            <Link href="/progress" className="text-accent hover:underline">
              Progress grid
            </Link>
            .
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="panel px-6 py-10 text-center text-sm text-fg-muted">
          {focus ? "Nothing left for this character." : "Every target is met."}{" "}
          <button type="button" onClick={() => setShow("all")} className="text-accent hover:underline">
            Show all targets
          </button>
        </p>
      ) : (
        <div className="space-y-8">
          {visible.map((g) => (
            <section key={g.scope}>
              <h2 className="mb-3 font-display text-lg font-semibold text-fg-muted">{g.title}</h2>
              <ul className="space-y-3">
                {g.targets.map((t) => (
                  <TargetCard
                    key={t.goal.id}
                    t={t}
                    focus={focus || null}
                    onEdit={() =>
                      setSheet({
                        subject: subjectFor(t.goal),
                        audience: { scope: t.goal.scope as GoalScope, characterId: t.goal.characterId, scopeKey: t.goal.scopeKey },
                      })
                    }
                  />
                ))}
              </ul>
            </section>
          ))}
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
