"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { Sheet } from "@/components/sheet";
import { overlapNotices, type OverlapPerson } from "@/lib/goals/overlap";
import { TIER_LABEL, type Goal, type GoalDomain, type GoalScope, type GoalTier } from "@/lib/goals/types";
import { targetTitle } from "@/lib/goals/review";
import { romanRank } from "@/lib/skills/ability";
import { MAX_ABILITY_RANK } from "@/lib/game/skills";
import { classColor } from "@/lib/classes";
import { TargetPicker } from "./target-picker";

/** Something a target can point at. */
export interface TargetSubject {
  domain: GoalDomain;
  name: string;
  /** Skill-line rank cap. Null for abilities and scripts. */
  cap: number | null;
  /** Owning class for class lines and class abilities. Null when anyone can train it. */
  className: string | null;
  /** Where it lives, for the picker: "Alliance War", "Assassination", "Focus script". */
  context: string;
  /** Skills window category: Class, Weapon, Armor, World, Guild, Alliance War, Racial, Craft. */
  category?: string;
  /** For abilities: the skill line it belongs to. */
  line?: string;
}

export interface TargetPerson {
  id: string;
  name: string;
  className: string;
  roleIds: string[];
}

export interface Audience {
  scope: GoalScope;
  characterId: string | null;
  scopeKey: string | null;
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function audienceLabel(a: Audience, people: TargetPerson[], roles: { id: string; name: string }[]): string {
  if (a.scope === "account") return "Everyone";
  if (a.scope === "character") return people.find((c) => c.id === a.characterId)?.name ?? "One character";
  if (a.scope === "class") return `Every ${a.scopeKey}`;
  return roles.find((r) => r.id === a.scopeKey)?.name ?? "A role";
}

/**
 * Set or change one target: what, for whom, and how far. Lists the targets
 * that already name the same thing, and says which one wins for whom before
 * anything is saved.
 */
export function TargetSheet({
  subject: givenSubject,
  choices = [],
  people,
  roles,
  goals,
  initial,
  onClose,
}: {
  /** What to target. Leave out to start with a picker. */
  subject?: TargetSubject | null;
  choices?: TargetSubject[];
  people: TargetPerson[];
  roles: { id: string; name: string }[];
  goals: Goal[];
  initial: Audience;
  onClose: () => void;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState<TargetSubject | null>(givenSubject ?? null);
  const [audience, setAudienceState] = useState<Audience>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // In the picker window, saving keeps the window open and says so briefly.
  const [saved, setSaved] = useState(0);

  const cap = subject?.domain === "skillline" ? (subject.cap ?? 50) : MAX_ABILITY_RANK;
  const onTarget = subject
    ? goals.filter((g) => g.domain === subject.domain && sameName(g.target, subject.name))
    : [];
  const existingFor = (a: Audience) =>
    onTarget.find(
      (g) =>
        g.scope === a.scope &&
        (g.characterId ?? null) === a.characterId &&
        (g.scopeKey ?? "").toLowerCase() === (a.scopeKey ?? "").toLowerCase(),
    );
  const startRank = (a: Audience, s: TargetSubject | null) => {
    const g = existingFor(a);
    if (s?.domain === "skillline") return g ? g.targetRank || g.extraRank || (s.cap ?? 50) : (s.cap ?? 50);
    return g?.targetRank ?? 0;
  };
  const [rank, setRank] = useState(() => startRank(initial, givenSubject ?? null));
  const [extra, setExtra] = useState(() => existingFor(initial)?.extraRank ?? 0);
  const [tier, setTier] = useState<GoalTier>(() => existingFor(initial)?.tier ?? "essential");

  function load(a: Audience, s: TargetSubject | null) {
    setRank(startRank(a, s));
    setExtra(existingFor(a)?.extraRank ?? 0);
    setTier(existingFor(a)?.tier ?? "essential");
  }
  function setAudience(next: Audience) {
    setAudienceState(next);
    load(next, subject);
  }

  const ownerClass = subject?.className ?? null;
  const classes = useMemo(() => {
    const present = [...new Set(people.map((c) => c.className))];
    return ownerClass ? present.filter((c) => c === ownerClass) : present;
  }, [people, ownerClass]);
  const same = existingFor(audience);
  const notices =
    subject && !same
      ? overlapNotices({
          domain: subject.domain,
          target: subject.name,
          next: audience,
          goals,
          people: people satisfies OverlapPerson[],
          roles,
          active: false,
        })
      : [];

  async function call(url: string, init: RequestInit): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save the target.");
        return false;
      }
      router.refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!subject) return;
    const isLine = subject.domain === "skillline";
    const extraRank = isLine && extra > rank ? extra : 0;
    const targetRank = subject.domain === "script" ? 0 : rank;
    const ok = same
      ? await call(`/api/goals/${same.id}`, {
          method: "PATCH",
          body: JSON.stringify({ targetRank, extraRank, tier: isLine ? same.tier : tier }),
        })
      : await call("/api/goals", {
          method: "POST",
          body: JSON.stringify({
            domain: subject.domain,
            tier: isLine ? "essential" : tier,
            scope: audience.scope,
            characterId: audience.characterId,
            scopeKey: audience.scopeKey,
            target: subject.name,
            targetRank,
            extraRank,
          }),
        });
    if (!ok) return;
    if (givenSubject) onClose();
    else setSaved(Date.now());
  }

  const scopeButton = (label: string, next: Audience, on: boolean, dot?: string) => (
    <button
      key={label}
      type="button"
      onClick={() => setAudience(next)}
      aria-pressed={on}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[13px] transition-colors ${
        on ? "border-accent bg-accent-soft text-fg" : "border-border text-fg-muted hover:border-border-strong hover:text-fg"
      }`}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} aria-hidden /> : null}
      {label}
    </button>
  );

  const actions = (
    <div className="flex items-center justify-between gap-3">
      {error ? (
        <p className="text-[13px] text-danger">{error}</p>
      ) : saved && !busy ? (
        <p className="text-[13px] text-ok" role="status">
          Saved
        </p>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        {givenSubject ? (
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-fg-muted hover:text-fg">
            Cancel
          </button>
        ) : null}
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="shrink-0 whitespace-nowrap rounded-md bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-fg disabled:opacity-60"
        >
          {same ? "Update target" : "Set target"}
        </button>
      </div>
    </div>
  );

  const editor = subject ? (
    <>
      <section className="mb-6">
        <h3 className="mb-2 text-sm font-medium text-fg">Who</h3>
        <div className="flex flex-wrap gap-1.5">
          {scopeButton("Everyone", { scope: "account", characterId: null, scopeKey: null }, audience.scope === "account")}
          {classes.map((cls) =>
            scopeButton(
              `Every ${cls}`,
              { scope: "class", characterId: null, scopeKey: cls },
              audience.scope === "class" && audience.scopeKey === cls,
            ),
          )}
          {roles.map((r) =>
            scopeButton(
              r.name,
              { scope: "role", characterId: null, scopeKey: r.id },
              audience.scope === "role" && audience.scopeKey === r.id,
            ),
          )}
        </div>
        {/* One character: a list, so a big roster never pushes the rank off screen. */}
        <label className="mt-2 flex items-center gap-2 text-[13px] text-fg-muted">
          <span className="shrink-0">Or one character</span>
          <select
            value={audience.scope === "character" ? (audience.characterId ?? "") : ""}
            onChange={(e) =>
              setAudience(
                e.target.value
                  ? { scope: "character", characterId: e.target.value, scopeKey: null }
                  : { scope: "account", characterId: null, scopeKey: null },
              )
            }
            className={`min-w-0 flex-1 rounded-md border bg-surface px-2 py-1 text-fg ${
              audience.scope === "character" ? "border-accent" : "border-border"
            }`}
          >
            <option value="">Choose a character</option>
            {people
              .filter((c) => !subject.className || c.className === subject.className)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.className})
                </option>
              ))}
          </select>
        </label>
      </section>

      {subject.domain === "skillline" ? (
        <section className="mb-6">
          <h3 className="mb-2 flex items-baseline justify-between text-sm font-medium text-fg">
            Reach rank
            <span className="font-display text-3xl font-semibold tabular-nums text-accent">{rank}</span>
          </h3>
          <input
            type="range"
            min={1}
            max={cap}
            value={rank}
            onChange={(e) => {
              const next = Number(e.target.value);
              setRank(next);
              if (extra <= next) setExtra(0);
            }}
            className="range-gold w-full"
            style={{
              background: `linear-gradient(to right, var(--accent) ${(rank / cap) * 100}%, var(--meter-track) ${(rank / cap) * 100}%)`,
            }}
            aria-label="Required rank"
          />
          {rank < cap ? (
            <label className="mt-4 flex items-center justify-between gap-3 text-sm text-fg-muted">
              <span>Nice to have, up to</span>
              <select
                value={extra}
                onChange={(e) => setExtra(Number(e.target.value))}
                className="rounded-md border border-border bg-surface px-2 py-1 text-fg"
              >
                <option value={0}>No extra</option>
                {Array.from({ length: cap - rank }, (_, i) => rank + i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </section>
      ) : (
        <section className="mb-6 space-y-4">
          {subject.domain === "ability" ? (
            <div>
              <h3 className="mb-2 text-sm font-medium text-fg">Rank</h3>
              <div className="flex flex-wrap gap-1.5">
                {[0, ...Array.from({ length: MAX_ABILITY_RANK }, (_, i) => i + 1)].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRank(n)}
                    aria-pressed={rank === n}
                    className={`rounded-md border px-3 py-1 text-[13px] ${
                      rank === n ? "border-accent bg-accent-soft text-fg" : "border-border text-fg-muted hover:text-fg"
                    }`}
                  >
                    {n === 0 ? "Max" : romanRank(n)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <h3 className="mb-2 text-sm font-medium text-fg">Priority</h3>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(TIER_LABEL) as GoalTier[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTier(t)}
                  aria-pressed={tier === t}
                  className={`rounded-md border px-3 py-1 text-[13px] ${
                    tier === t ? "border-accent bg-accent-soft text-fg" : "border-border text-fg-muted hover:text-fg"
                  }`}
                >
                  {TIER_LABEL[t]}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {same || notices.length > 0 ? (
        <section className="mb-6 rounded-lg border border-border bg-surface px-4 py-3 text-[13px] text-fg-muted">
          {same ? (
            <p>
              {audienceLabel(audience, people, roles)} already has this target ({targetTitle(same)}). Saving updates it.
            </p>
          ) : (
            notices.map((n) => <p key={n.goalId}>{n.sentence}</p>)
          )}
        </section>
      ) : null}

      {onTarget.length > 0 ? (
        <section>
          <h3 className="mb-2 text-sm font-medium text-fg">Saved targets for {subject.name}</h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {onTarget.map((g) => {
              const who = audienceLabel({ scope: g.scope, characterId: g.characterId, scopeKey: g.scopeKey }, people, roles);
              const color =
                g.scope === "character" ? classColor(people.find((c) => c.id === g.characterId)?.className ?? "") : undefined;
              return (
                <li key={g.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  {color ? <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden /> : null}
                  <span className="min-w-0 flex-1 truncate text-fg">{who}</span>
                  <span className="tabular-nums text-fg-muted">{targetTitle(g).slice(g.target.length).trim() || "—"}</span>
                  <button
                    type="button"
                    aria-label={`Remove the target for ${who}`}
                    onClick={() => call(`/api/goals/${g.id}`, { method: "DELETE" })}
                    className="rounded p-1 text-fg-subtle hover:bg-surface-2 hover:text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  ) : null;

  if (givenSubject && subject) {
    return (
      <Sheet title={subject.name} subtitle={subject.context} onClose={onClose} footer={actions}>
        {editor}
      </Sheet>
    );
  }

  // Picked from the list: the editor opens beside it in the same window, so
  // the list, the categories and the search stay exactly where they were.
  return (
    <Sheet
      variant="center"
      title="Edit targets"
      subtitle="Pick something to target, or one you already have to change or remove."
      onClose={onClose}
    >
      <TargetPicker
        choices={choices}
        goals={goals}
        selected={subject}
        onPick={(s) => {
          setSubject(s);
          setError(null);
          setSaved(0);
          load(audience, s);
        }}
        aside={
          subject ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-xl text-fg">{subject.name}</h3>
                  <p className="truncate text-[12px] text-fg-subtle">{subject.className ?? subject.context}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubject(null)}
                  aria-label="Close the editor"
                  className="-mr-1 rounded-md p-1.5 text-fg-subtle hover:bg-surface-2 hover:text-fg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">{editor}</div>
              <div className="mt-3 border-t border-border pt-3">{actions}</div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center px-4 text-center text-[13px] text-fg-subtle">
              Pick a skill line, ability or script to set or change its target.
            </div>
          )
        }
      />
    </Sheet>
  );
}
