"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { classColor } from "@/lib/classes";
import { TIER_LABEL, type Goal, type GoalScope, type GoalTier } from "@/lib/goals/types";
import type { ReviewGroup, ReviewTarget } from "@/lib/goals/review";
import type { GoalMarkView } from "@/lib/goals/views";
import { TargetSheet, type Audience, type TargetPerson, type TargetSubject } from "./target-sheet";

const TIERS: GoalTier[] = ["essential", "optional", "completionist"];

const TIER_TONE: Record<GoalTier, { dot: string; ring: string }> = {
  essential: { dot: "var(--accent)", ring: "color-mix(in srgb, var(--accent) 45%, transparent)" },
  optional: { dot: "var(--info)", ring: "color-mix(in srgb, var(--info) 40%, transparent)" },
  completionist: { dot: "var(--fg-subtle)", ring: "var(--border)" },
};

type View = "character" | "target";
type Show = "open" | "all";

interface Item {
  t: ReviewTarget;
  mark: GoalMarkView;
}

const isDone = (m: GoalMarkView) => m.state === "done";

/** Short name for a chip: "Fighters Guild 10" → the line, with the mark beside it. */
function chipName(t: ReviewTarget): string {
  return t.goal.domain === "skillline" ? t.goal.target : t.title;
}

function Chip({ item, onEdit, showTier }: { item: Item; onEdit: () => void; showTier?: boolean }) {
  const done = isDone(item.mark);
  const tone = TIER_TONE[item.t.goal.tier];
  return (
    <button
      type="button"
      onClick={onEdit}
      title={`${item.t.title} · ${TIER_LABEL[item.t.goal.tier]} · ${item.t.audience}\n${item.mark.label}${item.mark.reason ? ` (${item.mark.reason})` : ""}\nClick to change this target`}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-[12px] transition-colors hover:bg-surface-2 ${
        done ? "border-border/60 text-fg-subtle" : "text-fg"
      }`}
      style={done ? undefined : { borderColor: tone.ring }}
    >
      {done ? (
        <Check className="h-3 w-3 text-ok" aria-label="Met" />
      ) : (
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tone.dot }} aria-hidden />
      )}
      <span className="truncate">{chipName(item.t)}</span>
      {showTier ? <span className="text-fg-subtle">{TIER_LABEL[item.t.goal.tier]}</span> : null}
      <span className={`shrink-0 tabular-nums ${done ? "" : item.mark.state === "short" ? "text-fg-muted" : "text-fg-subtle"}`}>
        {item.mark.label}
      </span>
    </button>
  );
}

function TierTally({ tier, items }: { tier: GoalTier; items: Item[] }) {
  const mine = items.filter((i) => i.t.goal.tier === tier && i.mark.state !== "unknown");
  if (mine.length === 0) return null;
  const done = mine.filter((i) => isDone(i.mark)).length;
  const all = done === mine.length;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]" title={`${TIER_LABEL[tier]}: ${done} of ${mine.length} met`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: TIER_TONE[tier].dot }} aria-hidden />
      <span className="text-fg-subtle">{TIER_LABEL[tier]}</span>
      <span className={`tabular-nums ${all ? "text-ok" : "text-fg"}`}>
        {done}/{mine.length}
      </span>
    </span>
  );
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
  const [view, setView] = useState<View>("character");
  const [show, setShow] = useState<Show>("open");
  const [focus, setFocus] = useState<string>("");
  const [sheet, setSheet] = useState<{ subject: TargetSubject | null; audience: Audience } | null>(null);

  const all = useMemo(() => groups.flatMap((g) => g.targets), [groups]);
  const total = all.length;
  const finished = all.filter((t) => t.complete).length;

  // What each character still has to do: every target that governs them.
  const byCharacter = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const t of all) {
      for (const p of t.people) {
        const list = map.get(p.id) ?? [];
        list.push({ t, mark: p.mark });
        map.set(p.id, list);
      }
    }
    const rank = (i: Item) => TIERS.indexOf(i.t.goal.tier);
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          Number(isDone(a.mark)) - Number(isDone(b.mark)) || rank(a) - rank(b) || chipName(a.t).localeCompare(chipName(b.t)),
      );
    }
    return map;
  }, [all]);

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
  const edit = (t: ReviewTarget) =>
    setSheet({
      subject: subjectFor(t.goal),
      audience: { scope: t.goal.scope as GoalScope, characterId: t.goal.characterId, scopeKey: t.goal.scopeKey },
    });

  const seg = <T extends string>(value: T, current: T, set: (v: T) => void, label: string) => (
    <button
      type="button"
      onClick={() => set(value)}
      aria-pressed={current === value}
      className={`rounded-md px-2.5 py-1 text-[13px] ${current === value ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"}`}
    >
      {label}
    </button>
  );

  const shownPeople = focus ? people.filter((p) => p.id === focus) : people;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Review by">
          {seg<View>("character", view, setView, "By character")}
          {seg<View>("target", view, setView, "By target")}
        </div>
        <div className="flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Show">
          {seg<Show>("open", show, setShow, "Still to do")}
          {seg<Show>("all", show, setShow, "Everything")}
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
          {finished} of {total} {total === 1 ? "target" : "targets"} met by everyone
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

      <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fg-subtle">
        {TIERS.map((tier) => (
          <span key={tier} className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: TIER_TONE[tier].dot }} aria-hidden />
            {TIER_LABEL[tier]}
          </span>
        ))}
        <span>Click any target to change it. A target for one character or class replaces a broader one for them.</span>
      </p>

      {total === 0 ? (
        <div className="party-module px-6 py-12 text-center">
          <h2 className="font-display text-2xl text-fg">No targets yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
            A target is something to work towards: a skill line rank, an ability, a scribing script. Set it for
            everyone, a class, a role or one character. The quickest way to set skill-line targets is the{" "}
            <Link href="/party/characters?view=skills" className="text-accent hover:underline">
              skill line grid
            </Link>
            .
          </p>
        </div>
      ) : view === "character" ? (
        <ul className="party-module divide-y divide-border/60 p-0">
          {shownPeople.map((p) => {
            const items = byCharacter.get(p.id) ?? [];
            const known = items.filter((i) => i.mark.state !== "unknown");
            const open = items.filter((i) => !isDone(i.mark));
            const chips = show === "open" ? open : items;
            const unknown = items.length > 0 && known.length === 0;
            return (
              <li key={p.id} className="grid gap-x-6 gap-y-2 px-5 py-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
                <div className="min-w-0">
                  <Link
                    href={`/party/c/${encodeURIComponent(p.id)}/skills`}
                    className="block truncate text-[14px] text-fg hover:text-accent"
                  >
                    {p.name}
                  </Link>
                  <span className="text-[12px]" style={{ color: classColor(p.className) ?? undefined }}>
                    {p.className}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {TIERS.map((tier) => (
                      <TierTally key={tier} tier={tier} items={items} />
                    ))}
                  </div>
                </div>
                <div className="flex min-w-0 flex-wrap content-start items-start gap-1.5">
                  {items.length === 0 ? (
                    <span className="text-[13px] text-fg-subtle">No targets apply to {p.name}.</span>
                  ) : unknown ? (
                    <span className="text-[13px] text-fg-subtle">
                      Not snapshotted yet: log {p.name} out once and their {items.length} targets fill in.
                    </span>
                  ) : chips.length === 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-ok">
                      <Check className="h-3.5 w-3.5" /> Every target met
                    </span>
                  ) : (
                    chips.map((i) => <Chip key={i.t.goal.id} item={i} onEdit={() => edit(i.t)} />)
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => {
            const targets = g.targets.filter((t) => {
              if (focus) {
                const mine = t.people.find((p) => p.id === focus);
                return !!mine && (show === "all" || !isDone(mine.mark));
              }
              return show === "all" || !t.complete;
            });
            if (targets.length === 0) return null;
            return (
              <section key={g.scope}>
                <h2 className="mb-2 font-display text-[17px] text-fg-muted">{g.title}</h2>
                <ul className="party-module divide-y divide-border/60 p-0">
                  {targets.map((t) => {
                    const people = focus ? t.people.filter((p) => p.id === focus) : t.people;
                    const short = people.filter((p) => !isDone(p.mark));
                    const shown = show === "all" ? people : short;
                    const done = people.length - short.length;
                    return (
                      <li key={t.goal.id} className="grid gap-x-6 gap-y-1.5 px-5 py-2.5 lg:grid-cols-[17rem_minmax(0,1fr)]">
                        <div className="min-w-0">
                          <button type="button" onClick={() => edit(t)} className="text-left text-[14px] text-fg hover:text-accent">
                            <span
                              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                              style={{ background: TIER_TONE[t.goal.tier].dot }}
                              aria-hidden
                            />
                            {t.title}
                          </button>
                          <p className="text-[12px] text-fg-subtle">
                            {t.audience} · {TIER_LABEL[t.goal.tier]}
                            {t.known > 0 ? ` · ${t.done} of ${t.known} met` : " · nobody snapshotted yet"}
                          </p>
                        </div>
                        <div className="flex flex-wrap content-start items-start gap-1.5">
                          {shown.map((p) => (
                            <Link
                              key={p.id}
                              href={`/party/c/${encodeURIComponent(p.id)}/skills${
                                t.goal.domain === "skillline" ? `?line=${encodeURIComponent(t.goal.target)}` : ""
                              }`}
                              title={`${p.name}: ${p.mark.label}`}
                              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[12px] hover:bg-surface-2 ${
                                isDone(p.mark) ? "border-border/60 text-fg-subtle" : "border-border text-fg"
                              }`}
                            >
                              {isDone(p.mark) ? <Check className="h-3 w-3 text-ok" /> : null}
                              {p.name}
                              <span className="tabular-nums text-fg-subtle">{p.mark.label}</span>
                            </Link>
                          ))}
                          {show === "open" && done > 0 ? (
                            <span className="px-1 py-0.5 text-[12px] text-fg-subtle">+ {done} met</span>
                          ) : null}
                          {t.overridden.length > 0 ? (
                            <span className="px-1 py-0.5 text-[12px] text-fg-subtle" title={t.overridden.map((o) => `${o.name}: ${o.by}`).join("\n")}>
                              {t.overridden.length} follow their own target
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
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
