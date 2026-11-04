"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import type { Goal, GoalTier } from "@/lib/goals/types";
import { TIERS, TIER_LABEL } from "@/lib/goals/types";
import type { GoalCardView, GoalMarkView } from "@/lib/goals/views";
import { Badge, Card, ProgressBar } from "./ui";
import { GoalMark } from "./goal-mark";
import { abilityTitle, skillLineTitle } from "@/lib/goals/types";
import { romanRank } from "@/lib/skills/ability";
import { SkillLinePlanner } from "./skill-line-planner";
import { groupPlannerLines } from "@/lib/planner/skill-groups";
import { isExcludedSkillLine } from "@/lib/catalog/excluded";

/**
 * The planner starts with the kind of thing you are planning. Skills, abilities,
 * and scribing each open their own categories, and those stay closed until chosen.
 */

export interface PlannerChoices {
  lines: { name: string; category: string; className: string | null; maxRank: number | null }[];
  scripts: { name: string; slot: string }[];
  abilities: { name: string; lineName: string; className: string | null }[];
  roles: { id: string; name: string }[];
  classes: string[];
  characters: { id: string; name: string; className: string; ranks?: { name: string; rank: number }[] }[];
}

const TIER_TONE: Record<GoalTier, "accent" | "muted" | "ok"> = {
  essential: "accent",
  optional: "muted",
  completionist: "ok",
};

const DOMAIN_SHORT: Record<Goal["domain"], string> = {
  skillline: "line",
  ability: "ability",
  script: "script",
};

function goalTitle(goal: Goal): string {
  if (goal.domain === "skillline") return skillLineTitle(goal);
  if (goal.domain === "ability") return abilityTitle(goal);
  return goal.target;
}

export function PlannerBoard({
  choices,
  cards,
}: {
  choices: PlannerChoices;
  cards: GoalCardView[];
}) {
  const router = useRouter();

  const [kind, setKind] = useState<"skills" | "abilities" | "scribing" | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scope, setScope] = useState<"account" | "role" | "class" | "character">("account");
  const [scopeKey, setScopeKey] = useState("");
  const [tier, setTier] = useState<GoalTier>("essential");
  /** 0 = the live cap (IV, or the passive's own cap). 1–4 = that rank. */
  const [abilityRank, setAbilityRank] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- View state ----
  const [charFilter, setCharFilter] = useState(""); // "" = everyone view
  const [domainFilter, setDomainFilter] = useState<"all" | Goal["domain"]>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);

  function chooseKind(next: "skills" | "abilities" | "scribing") {
    setKind(next);
    setSelected(new Set());
    setError(null);
  }

  function toggleSelected(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const scriptGroups = useMemo(() => {
    const bySlot = new Map<string, typeof choices.scripts>();
    for (const s of choices.scripts) {
      const arr = bySlot.get(s.slot);
      if (arr) arr.push(s);
      else bySlot.set(s.slot, [s]);
    }
    return [...bySlot.entries()].map(([key, entries]) => ({ key, entries }));
  }, [choices]);

  const scopeLabel = (goal: Goal): string => {
    if (goal.scope === "account") return "Everyone";
    if (goal.scope === "class") return goal.scopeKey ?? "";
    if (goal.scope === "character")
      return choices.characters.find((c) => c.id === goal.characterId)?.name ?? "One character";
    return choices.roles.find((r) => r.id === goal.scopeKey)?.name ?? "role";
  };

  async function post(body: Record<string, unknown>, onDone?: () => void): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { error?: string; created?: string[] };
      if (!res.ok) {
        setError(json.created?.length ? `${json.created.length} saved, then: ${json.error}` : json.error ?? "Could not save.");
        router.refresh();
        return false;
      }
      onDone?.();
      router.refresh();
      return true;
    } catch {
      setError("Request failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addSelected() {
    if (kind !== "abilities" && kind !== "scribing") return;
    if (selected.size === 0) return;
    await post(
      {
        domain: kind === "abilities" ? "ability" : "script",
        tier,
        scope,
        characterId: scope === "character" ? scopeKey : null,
        scopeKey: scope === "role" || scope === "class" ? scopeKey : null,
        targets: [...selected],
        targetRank: kind === "abilities" ? abilityRank : 0,
      },
      () => setSelected(new Set()),
    );
  }

  // ---- The character view: what's left on this toon ----
  const nextUp = useMemo(() => {
    if (!charFilter) return [];
    const out: { goal: Goal; mark: GoalMarkView }[] = [];
    for (const card of cards) {
      const row = card.rows.find((r) => r.id === charFilter);
      if (row && row.mark.state !== "done" && row.mark.state !== "notapplicable") {
        out.push({ goal: card.goal, mark: row.mark });
      }
    }
    return out.sort(
      (a, b) => TIERS.indexOf(a.goal.tier) - TIERS.indexOf(b.goal.tier) || a.goal.target.localeCompare(b.goal.target),
    );
  }, [cards, charFilter]);

  const doneCount = useMemo(() => {
    if (!charFilter) return 0;
    return cards.filter((c) => c.rows.find((r) => r.id === charFilter)?.mark.state === "done").length;
  }, [cards, charFilter]);

  function visibleCards(list: GoalCardView[]): GoalCardView[] {
    let out = list.filter((c) => c.goal.domain !== "skillline");
    if (domainFilter === "ability" || domainFilter === "script") out = out.filter((c) => c.goal.domain === domainFilter);
    if (charFilter) out = out.filter((c) => c.rows.some((r) => r.id === charFilter));
    return out;
  }

  async function removeGoal(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/goals/${encodeURIComponent(id)}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function changeAbilityRank(goal: Goal, rank: number) {
    setBusy(true);
    try {
      await fetch(`/api/goals/${encodeURIComponent(goal.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetRank: rank }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function changeTier(goal: Goal, next: GoalTier) {
    setBusy(true);
    try {
      await fetch(`/api/goals/${encodeURIComponent(goal.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier: next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const otherCards = cards.filter((c) => c.goal.domain !== "skillline");

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="What to plan">
          {(
            [
              ["skills", "Skills"],
              ["abilities", "Abilities"],
              ["scribing", "Scribing"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={kind === id}
              onClick={() => chooseKind(id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                kind === id
                  ? "border-accent/60 bg-accent-soft font-medium text-accent"
                  : "border-border text-fg-muted hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
          {cards.length > 0 &&
            (confirmClear ? (
              <button
                type="button"
                onClick={async () => {
                  setConfirmClear(false);
                  setBusy(true);
                  try {
                    for (const c of cards) await fetch(`/api/goals/${encodeURIComponent(c.goal.id)}`, { method: "DELETE" });
                  } finally {
                    setBusy(false);
                    router.refresh();
                  }
                }}
                className="ml-auto rounded-full border border-danger/50 px-3 py-1 text-xs text-danger"
              >
                Really remove everything? Click again
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setConfirmClear(true);
                  setTimeout(() => setConfirmClear(false), 4000);
                }}
                className="ml-auto rounded-full border border-border px-3 py-1 text-xs text-fg-subtle hover:text-fg"
              >
                Clear all targets
              </button>
            ))}
        </div>
      </Card>

      {kind === "skills" && (
        <SkillLinePlanner
          lines={choices.lines}
          roles={choices.roles}
          classes={choices.classes}
          characters={choices.characters.map((c) => ({ ...c, ranks: c.ranks ?? [] }))}
          cards={cards}
        />
      )}

      {kind === "abilities" && (
        <Card className="p-4">
          <ComposerBar
            choices={choices}
            scope={scope}
            scopeKey={scopeKey}
            onScope={(s, k) => {
              setScope(s);
              setScopeKey(k);
            }}
            tier={tier}
            onTier={setTier}
            abilityRank={abilityRank}
            onAbilityRank={setAbilityRank}
            showRank
          />
          <AbilityCategories
            choices={choices}
            selected={selected}
            onToggle={toggleSelected}
          />
          <AddBar busy={busy} count={selected.size} enabled={scopeOk(scope, scopeKey)} onAdd={addSelected} />
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </Card>
      )}

      {kind === "scribing" && (
        <Card className="p-4">
          <ComposerBar
            choices={choices}
            scope={scope}
            scopeKey={scopeKey}
            onScope={(s, k) => {
              setScope(s);
              setScopeKey(k);
            }}
            tier={tier}
            onTier={setTier}
          />
          <ScriptCategories groups={scriptGroups} selected={selected} onToggle={toggleSelected} />
          <AddBar busy={busy} count={selected.size} enabled={scopeOk(scope, scopeKey)} onAdd={addSelected} />
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </Card>
      )}

      {/* ---------- Next up: the toon I'm playing ---------- */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-fg">Next up</div>
          <select
            value={charFilter}
            onChange={(e) => setCharFilter(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg focus:border-accent focus:outline-none"
          >
            <option value="">Everyone — overview</option>
            {choices.characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.className})
              </option>
            ))}
          </select>
        </div>
        {charFilter === "" ? (
          <p className="mt-2 text-xs text-fg-subtle">
            Pick the character you&apos;re playing and the planner tells you what&apos;s left on them — the targets below
            re-scope to that toon too.
          </p>
        ) : nextUp.length === 0 ? (
          <p className="mt-2 text-sm text-fg-muted">
            Nothing left — every target on this character is done. {doneCount > 0 ? `(${doneCount} done)` : ""}
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {nextUp.slice(0, 8).map(({ goal, mark }) => (
              <li
                key={goal.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs"
              >
                <Badge tone={TIER_TONE[goal.tier]}>{DOMAIN_SHORT[goal.domain]}</Badge>
                <span className="text-fg">{goalTitle(goal)}</span>
                <span className="text-fg-subtle">{mark.label}</span>
              </li>
            ))}
            {nextUp.length > 8 && <li className="text-xs text-fg-subtle">+{nextUp.length - 8} more below</li>}
          </ul>
        )}
      </Card>

      {/* ---------- Targets, organized by tier ---------- */}
      {otherCards.length === 0 ? null : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "ability", "script"] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={domainFilter === d}
                onClick={() => setDomainFilter(d)}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  domainFilter === d
                    ? "border-accent/60 bg-accent-soft font-medium text-accent"
                    : "border-border text-fg-muted hover:text-fg"
                }`}
              >
                {d === "all" ? "Abilities & scripts" : d === "ability" ? "Abilities" : "Scripts"}
              </button>
            ))}
            {charFilter && (
              <button
                type="button"
                onClick={() => setCharFilter("")}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-fg-muted hover:text-fg"
              >
                Showing one character · show everyone
              </button>
            )}
          </div>

          {TIERS.map((t) => {
            const tierCards = visibleCards(cards.filter((c) => c.goal.tier === t));
            if (tierCards.length === 0) return null;
            return (
              <section key={t}>
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge tone={TIER_TONE[t]}>{TIER_LABEL[t]}</Badge>
                  <span className="text-xs text-fg-subtle">{tierCards.length}</span>
                </div>
                <Card className="divide-y divide-border overflow-hidden">
                  {tierCards.map((card) => (
                    <TargetRow
                      key={card.goal.id}
                      card={card}
                      charFilter={charFilter}
                      choices={choices}
                      expanded={expanded.has(card.goal.id)}
                      onToggle={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(card.goal.id)) next.delete(card.goal.id);
                          else next.add(card.goal.id);
                          return next;
                        })
                      }
                      scopeLabel={scopeLabel}
                      onRemove={() => removeGoal(card.goal.id)}
                      onTier={(nt) => changeTier(card.goal, nt)}
                      onAbilityRank={(rank) => changeAbilityRank(card.goal, rank)}
                    />
                  ))}
                </Card>
              </section>
            );
          })}

          {visibleCards(cards).length === 0 && (
            <Card className="px-4 py-6 text-center text-sm text-fg-muted">
              No targets match this filter.
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/** One target as a compact row: title, scope, progress; detail expands on demand. */
function TargetRow({
  card,
  charFilter,
  choices,
  expanded,
  onToggle,
  scopeLabel,
  onRemove,
  onTier,
  onAbilityRank,
}: {
  card: GoalCardView;
  charFilter: string;
  choices: PlannerChoices;
  expanded: boolean;
  onToggle: () => void;
  scopeLabel: (goal: Goal) => string;
  onRemove: () => void;
  onTier: (tier: GoalTier) => void;
  onAbilityRank: (rank: number) => void;
}) {
  const { goal } = card;
  const title = goalTitle(goal);
  const charRow = charFilter ? card.rows.find((r) => r.id === charFilter) : undefined;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
        <button type="button" onClick={onToggle} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronDown className={`h-4 w-4 shrink-0 text-accent transition-transform ${expanded ? "" : "-rotate-90"}`} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-fg">
              {title} <span className="font-normal text-fg-subtle">· {scopeLabel(goal)}</span>
            </span>
            {goal.note ? <span className="block truncate text-xs text-fg-subtle">{goal.note}</span> : null}
          </span>
        </button>

        {charRow ? (
          <GoalMark mark={charRow.mark} />
        ) : (
          <span className="w-24 shrink-0">
            <ProgressBar value={card.done} max={card.total || 1} />
          </span>
        )}
        <span className="w-14 shrink-0 text-right text-xs tabular-nums text-fg-muted">
          {charRow ? "" : `${card.done}/${card.total}`}
        </span>

        {goal.domain === "ability" && (
          <select
            value={goal.targetRank}
            onChange={(e) => onAbilityRank(Number(e.target.value))}
            className="shrink-0 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-fg-muted"
            aria-label="Ability rank"
          >
            <option value={0}>Cap</option>
            <option value={1}>I</option>
            <option value={2}>II</option>
            <option value={3}>III</option>
            <option value={4}>IV</option>
          </select>
        )}
        <select
          value={goal.tier}
          onChange={(e) => onTier(e.target.value as GoalTier)}
          className="shrink-0 rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-fg-muted"
          aria-label="Tier"
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABEL[t]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded p-1 text-fg-subtle hover:text-danger"
          aria-label={`Delete ${title}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-border/60 bg-surface/40 px-4 py-2">
          {card.rows.length === 0 ? (
            <p className="py-1.5 text-xs text-fg-subtle">No live character matches this target.</p>
          ) : (
            <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
              {card.rows.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-2 py-1 text-sm">
                  <span className="min-w-0 truncate text-fg-muted">
                    {r.name}
                    {choices.characters.find((c) => c.id === r.id)?.className ? (
                      <span className="ml-1 text-xs text-fg-subtle">
                        {choices.characters.find((c) => c.id === r.id)?.className}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0">
                    <GoalMark mark={r.mark} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {(card.unknown > 0 || card.notApplicable > 0) && (
            <p className="pt-1.5 text-xs text-fg-subtle">
              {card.unknown > 0 ? `${card.unknown} not scanned yet` : ""}
              {card.unknown > 0 && card.notApplicable > 0 ? " · " : ""}
              {card.notApplicable > 0 ? `${card.notApplicable} can never have this (other class / no curse)` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Who a target applies to, as a couple of compact selects. */
function ScopePicker({
  choices,
  scope,
  scopeKey,
  onScope,
}: {
  choices: PlannerChoices;
  scope: "account" | "role" | "class" | "character";
  scopeKey: string;
  onScope: (scope: "account" | "role" | "class" | "character", key: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
      <span>for</span>
      <select
        value={scope === "account" ? "account" : scopeKey || ""}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "account") onScope("account", "");
          else if (choices.roles.some((r) => r.id === v)) onScope("role", v);
          else if (choices.classes.includes(v)) onScope("class", v);
          else onScope("character", v);
        }}
        className="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-fg focus:border-accent focus:outline-none"
      >
        <option value="account">Everyone</option>
        {choices.roles.length > 0 && <optgroup label="Roles">
          {choices.roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </optgroup>}
        <optgroup label="Classes">
          {choices.classes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </optgroup>
        <optgroup label="Characters">
          {choices.characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  );
}

function scopeOk(scope: "account" | "role" | "class" | "character", scopeKey: string): boolean {
  if (scope === "account") return true;
  return scopeKey.trim().length > 0;
}

const SCRIPT_SLOT_ORDER = ["focus", "signature", "affix"];

function ComposerBar({
  choices,
  scope,
  scopeKey,
  onScope,
  tier,
  onTier,
  abilityRank,
  onAbilityRank,
  showRank = false,
}: {
  choices: PlannerChoices;
  scope: "account" | "role" | "class" | "character";
  scopeKey: string;
  onScope: (scope: "account" | "role" | "class" | "character", key: string) => void;
  tier: GoalTier;
  onTier: (tier: GoalTier) => void;
  abilityRank?: number;
  onAbilityRank?: (rank: number) => void;
  showRank?: boolean;
}) {
  return (
    <div className="border-b border-border pb-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <ScopePicker choices={choices} scope={scope} scopeKey={scopeKey} onScope={onScope} />
        {showRank && onAbilityRank && (
          <div className="inline-flex items-center gap-1">
            <span className="text-xs text-fg-subtle">Rank</span>
            <div className="inline-flex gap-0.5 rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Ability rank">
              {([0, 1, 2, 3, 4] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={abilityRank === n}
                  onClick={() => onAbilityRank(n)}
                  className={`rounded-md px-2 py-1 text-xs ${
                    abilityRank === n ? "bg-accent-soft font-medium text-accent" : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {n === 0 ? "Cap" : romanRank(n)}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="inline-flex gap-0.5 rounded-lg border border-border bg-surface p-0.5">
          {TIERS.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tier === t}
              onClick={() => onTier(t)}
              className={`rounded-md px-2 py-1 text-xs ${
                tier === t ? "bg-accent-soft font-medium text-accent" : "text-fg-muted hover:text-fg"
              }`}
            >
              {TIER_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      {showRank && (
        <p className="mt-2 text-xs text-fg-subtle">
          Cap is each skill&apos;s own maximum from the game: IV for an ability or morph, or the passive&apos;s upgrade cap.
        </p>
      )}
    </div>
  );
}

function AddBar({
  busy,
  count,
  enabled,
  onAdd,
}: {
  busy: boolean;
  count: number;
  enabled: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <span className="text-xs text-fg-subtle">
        {count === 0 ? "Open a category, then pick from a skill line" : `${count} target${count === 1 ? "" : "s"} selected`}
      </span>
      <button
        type="button"
        disabled={busy || count === 0 || !enabled}
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent hover:text-accent-fg disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Add {count > 0 ? `${count} target${count === 1 ? "" : "s"}` : ""}
      </button>
    </div>
  );
}

function CategoryToggle({
  title,
  count,
  open,
  onToggle,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="flex w-full items-center gap-2 py-1.5 text-left"
    >
      <ChevronDown className={`h-4 w-4 shrink-0 text-accent transition-transform ${open ? "" : "-rotate-90"}`} />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{title}</span>
      <span className="text-[11px] text-fg-subtle">{count}</span>
    </button>
  );
}

function AbilityCategories({
  choices,
  selected,
  onToggle,
}: {
  choices: PlannerChoices;
  selected: Set<string>;
  onToggle: (name: string) => void;
}) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [openLines, setOpenLines] = useState<Set<string>>(new Set());
  const categories = useMemo(
    () => groupPlannerLines(choices.lines.filter((l) => !isExcludedSkillLine(l)), choices.classes),
    [choices.lines, choices.classes],
  );
  const abilitiesFor = (lineName: string) =>
    choices.abilities.filter((a) => a.lineName.toLowerCase() === lineName.toLowerCase());

  function toggleSet(setter: (value: Set<string>) => void, current: Set<string>, key: string) {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setter(next);
  }

  function lineBlock(lines: PlannerChoices["lines"]) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {lines.map((line) => {
            const expanded = openLines.has(line.name.toLowerCase());
            return (
              <button
                key={line.name}
                type="button"
                aria-expanded={expanded}
                onClick={() => toggleSet(setOpenLines, openLines, line.name.toLowerCase())}
                className={`rounded-full border px-2.5 py-1 text-xs ${
                  expanded ? "border-accent/60 bg-accent-soft font-medium text-accent" : "border-border text-fg-muted hover:text-fg"
                }`}
              >
                {line.name}
              </button>
            );
          })}
        </div>
        {lines
          .filter((line) => openLines.has(line.name.toLowerCase()))
          .map((line) => {
            const abilities = abilitiesFor(line.name);
            return (
              <div key={line.name} className="rounded-lg border border-border/70 p-2">
                <div className="mb-1 flex items-center justify-between px-1">
                  <span className="text-xs text-fg-subtle">{line.name}</span>
                  {abilities.length > 0 && (
                    <button
                      type="button"
                      onClick={() => abilities.forEach((a) => onToggle(a.name))}
                      className="text-[11px] text-fg-subtle hover:text-accent"
                    >
                      {abilities.every((a) => selected.has(a.name)) ? "Deselect all" : "Select all"}
                    </button>
                  )}
                </div>
                {abilities.length === 0 ? (
                  <p className="px-1 py-1 text-xs text-fg-subtle">No abilities known for this line yet.</p>
                ) : (
                  abilities.map((a) => (
                    <PickerRow
                      key={a.name}
                      name={a.name}
                      hint={a.className ?? line.name}
                      checked={selected.has(a.name)}
                      onToggle={() => onToggle(a.name)}
                    />
                  ))
                )}
              </div>
            );
          })}
      </div>
    );
  }

  return (
    <div className="mt-2">
      {categories.map((category) => {
        const open = openCategories.has(category.key);
        const count = category.classes ? category.classes.reduce((n, c) => n + c.lines.length, 0) : category.lines.length;
        return (
          <section key={category.key} className="border-t border-border/60">
            <CategoryToggle
              title={category.title}
              count={count}
              open={open}
              onToggle={() => toggleSet(setOpenCategories, openCategories, category.key)}
            />
            {open && (
              <div className="space-y-3 pb-3 pl-6">
                {category.classes
                  ? category.classes.map((klass) => (
                      <div key={klass.name}>
                        <div className="mb-1.5 text-sm text-fg">{klass.name}</div>
                        {lineBlock(klass.lines)}
                      </div>
                    ))
                  : lineBlock(category.lines)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ScriptCategories({
  groups,
  selected,
  onToggle,
}: {
  groups: { key: string; entries: { name: string; slot: string }[] }[];
  selected: Set<string>;
  onToggle: (name: string) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const ordered = [...groups].sort((a, b) => {
    const ia = SCRIPT_SLOT_ORDER.indexOf(a.key.toLowerCase());
    const ib = SCRIPT_SLOT_ORDER.indexOf(b.key.toLowerCase());
    return (ia < 0 ? 90 : ia) - (ib < 0 ? 90 : ib) || a.key.localeCompare(b.key);
  });
  return (
    <div className="mt-2">
      {ordered.map((group) => {
        const expanded = open.has(group.key);
        const title = group.key.charAt(0).toUpperCase() + group.key.slice(1);
        return (
          <section key={group.key} className="border-t border-border/60">
            <CategoryToggle
              title={title}
              count={group.entries.length}
              open={expanded}
              onToggle={() =>
                setOpen((prev) => {
                  const next = new Set(prev);
                  if (next.has(group.key)) next.delete(group.key);
                  else next.add(group.key);
                  return next;
                })
              }
            />
            {expanded && (
              <div className="pb-2 pl-6">
                <GroupBlock
                  title={`${title} scripts`}
                  selected={selected}
                  entries={group.entries.map((s) => ({ name: s.name, hint: s.slot }))}
                  onToggle={onToggle}
                />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** A clickable item in a picker modal. */
function PickerRow({ name, hint, checked, onToggle }: { name: string; hint: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onToggle}
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition ${
        checked ? "bg-accent-soft" : "hover:bg-surface-2"
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          checked ? "border-accent bg-accent text-accent-fg" : "border-border-strong text-transparent"
        }`}
      >
        <Check className="h-3 w-3" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate ${checked ? "font-medium text-fg" : "text-fg"}`}>{name}</span>
        <span className="block truncate text-xs text-fg-subtle">{hint}</span>
      </span>
    </button>
  );
}

/** A titled block of picker items with a select-all header. */
function GroupBlock({
  title,
  selected,
  entries,
  onToggle,
}: {
  title: string;
  selected: Set<string>;
  entries: { name: string; hint: string }[];
  onToggle: (name: string) => void;
}) {
  const all = entries.length > 0 && entries.every((e) => selected.has(e.name));
  return (
    <div className="mb-2 last:mb-0">
      <div className="flex items-center justify-between gap-2 px-2.5 py-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{title}</span>
        <button
          type="button"
          onClick={() => entries.forEach((e) => onToggle(e.name))}
          className="text-[11px] text-fg-subtle transition hover:text-accent"
        >
          {all ? "Deselect all" : "Select all"}
        </button>
      </div>
      <div className="space-y-0.5">
        {entries.map((e) => (
          <PickerRow key={e.name} name={e.name} hint={e.hint} checked={selected.has(e.name)} onToggle={() => onToggle(e.name)} />
        ))}
      </div>
    </div>
  );
}
