"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Modal } from "./modal";
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

  // ---- Composer state: three buttons, each opens a picker modal ----
  const [composer, setComposer] = useState<Goal["domain"] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [abilityQuery, setAbilityQuery] = useState("");
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

  function openComposer(domain: Goal["domain"]) {
    setComposer(domain);
    setSelected(new Set());
    setAbilityQuery("");
    setScope("account");
    setScopeKey("");
    setTier("essential");
    setRank(50);
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

  /** Skill lines: shared lines by category, class lines after, under their class. */
  const lineGroups = useMemo(() => {
    const shared = choices.lines.filter((l) => l.category.toLowerCase() !== "class");
    const cls = choices.lines.filter((l) => l.category.toLowerCase() === "class");
    const byKey = new Map<string, typeof shared>();
    for (const l of [...shared, ...cls]) {
      const key = l.category.toLowerCase() === "class" ? `${l.className} — class` : l.category;
      const arr = byKey.get(key);
      if (arr) arr.push(l);
      else byKey.set(key, [l]);
    }
    return [...byKey.entries()].map(([key, entries]) => ({ key, entries }));
  }, [choices]);

  const scriptGroups = useMemo(() => {
    const bySlot = new Map<string, typeof choices.scripts>();
    for (const s of choices.scripts) {
      const arr = bySlot.get(s.slot);
      if (arr) arr.push(s);
      else bySlot.set(s.slot, [s]);
    }
    return [...bySlot.entries()].map(([key, entries]) => ({ key, entries }));
  }, [choices]);

  const abilityMatches = useMemo(() => {
    const q = abilityQuery.trim().toLowerCase();
    const list = q ? choices.abilities.filter((a) => a.name.toLowerCase().includes(q)) : choices.abilities;
    return list.slice(0, 150);
  }, [choices, abilityQuery]);

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

  async function addSelected() {
    if (!composer || selected.size === 0) return;
    await post(
      {
        domain: composer,
        tier,
        scope,
        characterId: scope === "character" ? scopeKey : null,
        scopeKey: scope === "role" || scope === "class" ? scopeKey : null,
        targets: [...selected],
        targetRank: composer === "skillline" ? rank : 0,
      },
      () => setComposer(null),
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
      {/* ---------- Composer: three buttons, each opens a picker modal ---------- */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <DomainButton label="Skill lines" hint="Line ranks — Assault 7, Heavy Armor 50…" onClick={() => openComposer("skillline")} />
          <DomainButton label="Abilities" hint="Exact abilities and morphs" onClick={() => openComposer("ability")} />
          <DomainButton label="Scribing scripts" hint="Focus, signature, affix" onClick={() => openComposer("script")} />
        </div>

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
        {error && !composer && <p className="mt-2 text-sm text-danger">{error}</p>}
      </Card>

      {/* ---------- The picker modal ---------- */}
      {composer && (
        <Modal
          title={`Add ${composer === "skillline" ? "skill line" : composer === "ability" ? "ability" : "scribing"} targets`}
          onClose={() => setComposer(null)}
          maxWidthClass="max-w-xl"
        >
          {/* Who + how much, decided once, applies to every selection below */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-3">
            <ScopePicker
              choices={choices}
              scope={scope}
              scopeKey={scopeKey}
              onScope={(s, k) => {
                setScope(s);
                setScopeKey(k);
              }}
            />
            {composer === "skillline" && (
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
          </div>

          {composer === "ability" && (
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
              <input
                value={abilityQuery}
                onChange={(e) => setAbilityQuery(e.target.value)}
                placeholder="Filter abilities…"
                className="w-full rounded-lg border border-border bg-surface py-1.5 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
              />
            </div>
          )}

          <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-border bg-surface/40 p-2">
            {composer === "skillline" &&
              lineGroups.map((group) => (
                <GroupBlock
                  key={group.key}
                  title={group.key}
                  selected={selected}
                  entries={group.entries.map((l) => ({
                    name: l.name,
                    hint: l.category + (l.className ? ` · ${l.className}` : ""),
                  }))}
                  onToggle={toggleSelected}
                />
              ))}
            {composer === "ability" &&
              (abilityMatches.length === 0 ? (
                <p className="px-2 py-3 text-sm text-fg-subtle">
                  Nothing matches. Abilities appear as your characters log out with the addon.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {abilityMatches.map((a) => (
                    <PickerRow
                      key={a.name}
                      name={a.name}
                      hint={a.lineName + (a.className ? ` · ${a.className}` : "")}
                      checked={selected.has(a.name)}
                      onToggle={() => toggleSelected(a.name)}
                    />
                  ))}
                  {choices.abilities.length > abilityMatches.length && (
                    <p className="px-2 pt-1 text-xs text-fg-subtle">
                      Showing {abilityMatches.length} of {choices.abilities.length} — keep typing to narrow.
                    </p>
                  )}
                </div>
              ))}
            {composer === "script" &&
              scriptGroups.map((group) => (
                <GroupBlock
                  key={group.key}
                  title={`${group.key} scripts`}
                  selected={selected}
                  entries={group.entries.map((s) => ({ name: s.name, hint: s.slot }))}
                  onToggle={toggleSelected}
                />
              ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-fg-subtle">
              {selected.size === 0
                ? "Pick anything from the list"
                : `${selected.size} target${selected.size === 1 ? "" : "s"} selected`}
            </span>
            <button
              type="button"
              disabled={busy || selected.size === 0 || !scopeOk(scope, scopeKey)}
              onClick={addSelected}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent hover:text-accent-fg disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add {selected.size > 0 ? `${selected.size} target${selected.size === 1 ? "" : "s"}` : ""}
            </button>
          </div>
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </Modal>
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

function scopeOk(scope: "account" | "role" | "class" | "character", scopeKey: string): boolean {
  if (scope === "account") return true;
  return scopeKey.trim().length > 0;
}

/** One of the three composer entry points. */
function DomainButton({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-3.5 py-2 text-sm font-medium text-accent transition hover:bg-accent hover:text-accent-fg"
    >
      <Plus className="h-4 w-4" />
      {label}
    </button>
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
