"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { Goal, GoalTier } from "@/lib/goals/types";
import { TIERS, TIER_LABEL } from "@/lib/goals/types";
import type { GoalCardView, GoalMarkView } from "@/lib/goals/views";
import { Badge, Card, ProgressBar } from "./ui";
import { GoalMark } from "./goal-mark";

/**
 * The Planner, built around what you want to do rather than the data model:
 *
 * - One search box adds anything (a line, an ability, a script). Pick who it
 *   applies to and how much it matters, done.
 * - Presets do the common bulk intents in one click.
 * - "Next up" answers the real question: what's left on the toon I'm playing?
 * - Targets are grouped by tier — Essential first — as compact rows with
 *   inline progress; per-character detail only expands when asked for.
 */

export interface PlannerChoices {
  lines: { name: string; category: string; className: string | null }[];
  scripts: { name: string; slot: string }[];
  abilities: { name: string; lineName: string; className: string | null }[];
  roles: { id: string; name: string }[];
  classes: string[];
  characters: { id: string; name: string; className: string }[];
}

interface SearchHit {
  domain: "skillline" | "ability" | "script";
  name: string;
  hint: string;
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

export function PlannerBoard({
  choices,
  cards,
}: {
  choices: PlannerChoices;
  cards: GoalCardView[];
}) {
  const router = useRouter();

  // ---- Composer state (one search → one popover, not a form) ----
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState<SearchHit | null>(null);
  const [scope, setScope] = useState<"account" | "role" | "class" | "character">("account");
  const [scopeKey, setScopeKey] = useState("");
  const [tier, setTier] = useState<GoalTier>("essential");
  const [rank, setRank] = useState(50);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- View state ----
  const [charFilter, setCharFilter] = useState(""); // "" = everyone view
  const [domainFilter, setDomainFilter] = useState<"all" | Goal["domain"]>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);

  const hits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: SearchHit[] = [];
    for (const l of choices.lines) {
      if (l.name.toLowerCase().includes(q))
        out.push({ domain: "skillline", name: l.name, hint: l.category + (l.className ? ` · ${l.className}` : "") });
    }
    for (const a of choices.abilities) {
      if (a.name.toLowerCase().includes(q))
        out.push({ domain: "ability", name: a.name, hint: a.lineName + (a.className ? ` · ${a.className}` : "") });
    }
    for (const s of choices.scripts) {
      if (s.name.toLowerCase().includes(q)) out.push({ domain: "script", name: s.name, hint: `${s.slot} script` });
    }
    return out.slice(0, 12);
  }, [query, choices]);

  const scopeLabel = (goal: Goal): string => {
    if (goal.scope === "account") return "Everyone";
    if (goal.scope === "class") return goal.scopeKey ?? "";
    if (goal.scope === "character")
      return choices.characters.find((c) => c.id === goal.characterId)?.name ?? "One character";
    return choices.roles.find((r) => r.id === goal.scopeKey)?.name ?? "role";
  };

  async function post(body: Record<string, unknown>, onDone?: () => void) {
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
      } else {
        onDone?.();
        router.refresh();
      }
    } catch {
      setError("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addPicked() {
    if (!picking) return;
    await post(
      {
        domain: picking.domain,
        tier,
        scope,
        characterId: scope === "character" ? scopeKey : null,
        scopeKey: scope === "role" || scope === "class" ? scopeKey : null,
        targets: [picking.name],
        targetRank: picking.domain === "skillline" ? rank : 0,
      },
      () => {
        setPicking(null);
        setQuery("");
      },
    );
  }

  async function preset(targets: string[], presetTier: GoalTier, presetDomain: Goal["domain"], label: string) {
    if (busy || targets.length === 0) return;
    await post({ domain: presetDomain, tier: presetTier, scope: "account", targets, targetRank: 50, note: label });
  }

  const weaponArmor = useMemo(
    () =>
      choices.lines
        .filter((l) => ["weapon", "armor"].includes(l.category.toLowerCase()))
        .map((l) => l.name),
    [choices.lines],
  );
  const sharedLines = useMemo(
    () => choices.lines.filter((l) => l.category.toLowerCase() !== "class").map((l) => l.name),
    [choices.lines],
  );

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
    let out = list;
    if (domainFilter !== "all") out = out.filter((c) => c.goal.domain === domainFilter);
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

  return (
    <div className="space-y-4">
      {/* ---------- Search-first composer ---------- */}
      <Card className="p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPicking(null);
            }}
            placeholder="Add a target — search a skill line, an ability, or a scribing script…"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setPicking(null);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-fg-subtle hover:text-fg"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {query && !picking && (
            <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-bg-elev shadow-xl">
              {hits.length === 0 ? (
                <p className="px-3 py-3 text-sm text-fg-subtle">
                  Nothing matches. Lines and abilities appear as your characters log out with the addon.
                </p>
              ) : (
                hits.map((hit) => (
                  <button
                    key={`${hit.domain}:${hit.name}`}
                    type="button"
                    onClick={() => {
                      setPicking(hit);
                      setTier("essential");
                      setScope("account");
                      setScopeKey("");
                      setRank(hit.domain === "skillline" ? 50 : 0);
                    }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-fg">{hit.name}</span>
                      <span className="block truncate text-xs text-fg-subtle">{hit.hint}</span>
                    </span>
                    <Badge tone="muted">{DOMAIN_SHORT[hit.domain]}</Badge>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {picking && (
          <div className="mt-3 rounded-lg border border-accent/40 bg-accent-soft/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-fg">
                {picking.name} <span className="text-xs font-normal text-fg-subtle">{picking.hint}</span>
              </span>
              <button
                type="button"
                onClick={() => setPicking(null)}
                className="rounded p-1 text-fg-subtle hover:text-fg"
                aria-label="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <ScopePicker
                choices={choices}
                scope={scope}
                scopeKey={scopeKey}
                onScope={(s, k) => {
                  setScope(s);
                  setScopeKey(k);
                }}
              />
              {picking.domain === "skillline" && (
                <label className="text-xs text-fg-subtle">
                  to rank
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={rank}
                    onChange={(e) => setRank(Number(e.target.value))}
                    className="ml-1.5 w-16 rounded border border-border bg-surface px-1.5 py-1 text-sm text-fg"
                  />
                </label>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex gap-0.5 rounded-lg border border-border bg-surface p-0.5">
                {TIERS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={tier === t}
                    onClick={() => setTier(t)}
                    className={`rounded-md px-2 py-1 text-xs ${
                      tier === t ? "bg-accent-soft font-medium text-accent" : "text-fg-muted hover:text-fg"
                    }`}
                  >
                    {TIER_LABEL[t]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={addPicked}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent hover:text-accent-fg disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add target
              </button>
            </div>
          </div>
        )}

        {/* Presets: the common intents, one click each */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
          <span className="mr-1 inline-flex items-center gap-1 text-xs text-fg-subtle">
            <Sparkles className="h-3.5 w-3.5 text-accent" /> Quick add:
          </span>
          <PresetButton
            label={`Weapon + armor to 50 · everyone · essential`}
            title="Every weapon and armor line to rank 50 for every character"
            onClick={() => preset(weaponArmor, "essential", "skillline", "weapon + armor to 50")}
          />
          <PresetButton
            label={`Every shared line to 50 · completionist`}
            title="All non-class lines to rank 50 for every character"
            onClick={() => preset(sharedLines, "completionist", "skillline", "every shared line to 50")}
          />
          <PresetButton
            label={`All scribing scripts · completionist`}
            title="Every known catalog script for every character"
            onClick={() => preset(
              choices.scripts.map((s) => s.name),
              "completionist",
              "script",
              "all scribing scripts",
            )}
          />
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
                className="rounded-full border border-danger/50 px-3 py-1 text-xs text-danger"
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
                className="rounded-full border border-border px-3 py-1 text-xs text-fg-subtle hover:text-fg"
              >
                Clear all targets
              </button>
            ))}
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </Card>

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
                <span className="text-fg">{goal.domain === "skillline" ? `${goal.target} ${goal.targetRank}` : goal.target}</span>
                <span className="text-fg-subtle">{mark.label}</span>
              </li>
            ))}
            {nextUp.length > 8 && <li className="text-xs text-fg-subtle">+{nextUp.length - 8} more below</li>}
          </ul>
        )}
      </Card>

      {/* ---------- Targets, organized by tier ---------- */}
      {cards.length === 0 ? (
        <Card className="px-5 py-8 text-center text-sm text-fg-muted">
          Nothing planned yet. Use a Quick add above (weapon + armor to 50 for everyone is the usual start), or search
          for any line, ability, or script.
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["all", "skillline", "ability", "script"] as const).map((d) => (
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
                {d === "all" ? "All targets" : d === "skillline" ? "Skill lines" : d === "ability" ? "Abilities" : "Scripts"}
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
}: {
  card: GoalCardView;
  charFilter: string;
  choices: PlannerChoices;
  expanded: boolean;
  onToggle: () => void;
  scopeLabel: (goal: Goal) => string;
  onRemove: () => void;
  onTier: (tier: GoalTier) => void;
}) {
  const { goal } = card;
  const title = goal.domain === "skillline" ? `${goal.target} ${goal.targetRank}` : goal.target;
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

function PresetButton({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-xs font-medium text-accent transition hover:bg-accent hover:text-accent-fg"
    >
      {label}
    </button>
  );
}