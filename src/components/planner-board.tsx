"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Search } from "lucide-react";
import type { Goal, GoalDomain, GoalScope, GoalTier } from "@/lib/goals/types";
import { TIERS, TIER_LABEL } from "@/lib/goals/types";
import type { PlannerData } from "@/lib/planner/data";
import { Badge, Card, SectionTitle } from "./ui";
import { GoalCard } from "./goal-card";

/**
 * The Planner: compose tiered targets (skill lines, abilities, scribing
 * scripts) for the account, a role, a class, or one character — then watch
 * per-character progress, straight from the last snapshot.
 */

const DOMAINS: { id: GoalDomain; label: string; hint: string }[] = [
  { id: "skillline", label: "Skill lines", hint: "Line ranks — Assault 7, Heavy Armor 50, a class line to 50…" },
  { id: "ability", label: "Abilities", hint: "Exact abilities or morphs every target character must own." },
  { id: "script", label: "Scribing", hint: "Scripts every target character must know." },
];

const SCOPES: { id: GoalScope; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "role", label: "Role" },
  { id: "class", label: "Class" },
  { id: "character", label: "Character" },
];

const TIER_HINT: Record<GoalTier, string> = {
  essential: "Must-have. The stuff you actually need.",
  optional: "Nice to have, no rush.",
  completionist: "Have it just to have it — the long grind.",
};

const TIER_TONE: Record<GoalTier, "accent" | "muted" | "ok"> = {
  essential: "accent",
  optional: "muted",
  completionist: "ok",
};

const DOMAIN_LABEL: Record<GoalDomain, string> = {
  skillline: "Skill lines",
  ability: "Abilities",
  script: "Scribing",
};

export function PlannerBoard({ data, goals }: { data: PlannerData; goals: Goal[] }) {
  const router = useRouter();
  const [domain, setDomain] = useState<GoalDomain>("skillline");
  const [tier, setTier] = useState<GoalTier>("essential");
  const [scope, setScope] = useState<GoalScope>("account");
  const [scopeKey, setScopeKey] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rank, setRank] = useState(50);
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sharedLines = useMemo(() => data.lines.filter((l) => l.category.toLowerCase() !== "class"), [data.lines]);
  const classLines = useMemo(() => data.lines.filter((l) => l.category.toLowerCase() === "class"), [data.lines]);

  const abilityMatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q
      ? data.abilities.filter((a) => a.name.toLowerCase().includes(q))
      : data.abilities.slice(0, 40);
    return list.slice(0, 60);
  }, [data.abilities, search]);

  function toggle(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function selectShared(which: "weapon-armor" | "all") {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const l of sharedLines) {
        const cat = l.category.toLowerCase();
        if (which === "weapon-armor" ? cat === "weapon" || cat === "armor" : true) {
          next.add(l.name);
        }
      }
      return next;
    });
    setRank(50);
  }

  async function submit() {
    if (busy || selected.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          domain,
          tier,
          scope,
          characterId: scope === "character" ? scopeKey : null,
          scopeKey: scope === "role" || scope === "class" ? scopeKey : null,
          targets: [...selected],
          targetRank: domain === "skillline" ? rank : 0,
          note,
        }),
      });
      const json = (await res.json()) as { error?: string; created?: string[] };
      if (!res.ok) {
        if (json.created && json.created.length > 0) {
          setError(`${json.created.length} saved, then: ${json.error}`);
          setSelected(new Set());
          setNote("");
          router.refresh();
        } else {
          setError(json.error ?? "Could not save targets.");
        }
        return;
      }
      setSelected(new Set());
      setNote("");
      router.refresh();
    } catch {
      setError("Request failed.");
    } finally {
      setBusy(false);
    }
  }

  const scopeNeedsKey = scope === "role" || scope === "class" || scope === "character";
  const canSubmit =
    selected.size > 0 && (!scopeNeedsKey || scopeKey.trim().length > 0) && (domain !== "skillline" || rank >= 1);

  const byDomainTier = useMemo(() => {
    const groups: { domain: GoalDomain; tiers: { tier: GoalTier; goals: Goal[] }[] }[] = [];
    for (const d of DOMAINS.map((x) => x.id)) {
      const forDomain = goals.filter((g) => g.domain === d);
      if (forDomain.length === 0) continue;
      const tiers = TIERS.map((t) => ({ tier: t, goals: forDomain.filter((g) => g.tier === t) })).filter(
        (t) => t.goals.length > 0,
      );
      if (tiers.length > 0) groups.push({ domain: d, tiers });
    }
    return groups;
  }, [goals]);

  const scopeBlocked =
    scope === "role" && data.roles.length === 0
      ? "No roles yet — create them on a character page (Tank, Healer…), then role targets appear here."
      : null;

  return (
    <div>
      {/* ---------- Composer ---------- */}
      <Card className="mb-6 p-5">
        <SectionTitle>Set a target</SectionTitle>

        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">What</div>
          <Segmented options={DOMAINS} value={domain} onChange={(d) => { setDomain(d as GoalDomain); setSelected(new Set()); }} />
          <p className="mt-1.5 text-xs text-fg-subtle">{DOMAINS.find((d) => d.id === domain)?.hint}</p>
        </div>

        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Who</div>
          <Segmented
            options={SCOPES.map((s) => ({ id: s.id, label: s.label, hidden: s.id === "class" && domain === "script" }))}
            value={scope}
            onChange={(s) => { setScope(s as GoalScope); setScopeKey(""); }}
          />
          {scopeBlocked && <p className="mt-1.5 text-xs text-accent">{scopeBlocked}</p>}
          {scopeNeedsKey && !scopeBlocked && (
            <select
              value={scopeKey}
              onChange={(e) => setScopeKey(e.target.value)}
              className="mt-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg focus:border-accent focus:outline-none"
            >
              <option value="">
                {scope === "role" ? "Pick a role…" : scope === "class" ? "Pick a class…" : "Pick a character…"}
              </option>
              {scope === "role" &&
                data.roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              {scope === "class" && data.classes.map((c) => <option key={c} value={c}>{c}</option>)}
              {scope === "character" &&
                data.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.className})
                  </option>
                ))}
            </select>
          )}
        </div>

        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">How much it matters</div>
          <Segmented
            options={TIERS.map((t) => ({ id: t, label: TIER_LABEL[t] }))}
            value={tier}
            onChange={(t) => setTier(t as GoalTier)}
          />
          <p className="mt-1.5 text-xs text-fg-subtle">{TIER_HINT[tier]}</p>
        </div>

        {domain === "skillline" && (
          <div className="mb-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Skill lines</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => selectShared("weapon-armor")}
                  className="rounded border border-border px-2 py-0.5 text-xs text-fg-muted hover:text-fg"
                >
                  Weapon + armor at 50
                </button>
                <button
                  type="button"
                  onClick={() => selectShared("all")}
                  className="rounded border border-border px-2 py-0.5 text-xs text-fg-muted hover:text-fg"
                >
                  All shared lines
                </button>
              </div>
            </div>
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border bg-surface/40 p-3">
              <LineChips
                title="Shared — every class can level these"
                groups={groupLines(sharedLines)}
                selected={selected}
                onToggle={toggle}
              />
              <LineChips
                title="Class lines — only apply to their own class"
                groups={groupLines(classLines)}
                selected={selected}
                onToggle={toggle}
              />
            </div>
            <label className="mt-3 block text-xs text-fg-subtle">
              Target rank
              <input
                type="number"
                min={1}
                max={50}
                value={rank}
                onChange={(e) => setRank(Number(e.target.value))}
                className="ml-2 w-20 rounded-lg border border-border bg-surface px-2 py-1 text-sm text-fg focus:border-accent focus:outline-none"
              />
            </label>
          </div>
        )}

        {domain === "ability" && (
          <div className="mb-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Abilities and morphs</div>
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search abilities — e.g. Inner, Aggressive Warhorn, Render Soul…"
                className="w-full rounded-lg border border-border bg-surface py-1.5 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
              />
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface/40 p-3">
              {abilityMatches.length === 0 ? (
                <p className="text-sm text-fg-subtle">Nothing matches. Log each character out with the addon to teach Nirnside their abilities.</p>
              ) : (
                abilityMatches.map((a) => (
                  <Chip
                    key={a.name}
                    active={selected.has(a.name)}
                    onClick={() => toggle(a.name)}
                    title={`${a.lineName}${a.className ? ` (${a.className})` : ""}`}
                    label={a.name}
                    suffix={a.className ? `${a.lineName} · ${a.className}` : a.lineName}
                  />
                ))
              )}
            </div>
            {selected.size > 0 && (
              <p className="mt-2 text-xs text-fg-muted">{selected.size} ability target(s) selected</p>
            )}
          </div>
        )}

        {domain === "script" && (
          <div className="mb-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Scribing scripts</div>
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border bg-surface/40 p-3">
              {(["focus", "signature", "affix"] as const).map((slot) => {
                const list = data.scripts.filter((s) => s.slot === slot);
                if (list.length === 0) return null;
                return (
                  <div key={slot}>
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                      {slot} · {list.length}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((s) => (
                        <Chip key={s.name} active={selected.has(s.name)} onClick={() => toggle(s.name)} label={s.name} />
                      ))}
                    </div>
                  </div>
                );
              })}
              {data.scripts.length === 0 && (
                <p className="text-sm text-fg-subtle">No scripts in the catalog yet — scan the in-game catalog to list them.</p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-xs text-fg-subtle">
            Reason <span className="text-fg-subtle/70">(optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={120}
              placeholder="e.g. trial-ready healers"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !canSubmit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent hover:bg-accent hover:text-accent-fg disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add {selected.size > 0 ? `${selected.size} target${selected.size === 1 ? "" : "s"}` : "target"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </Card>

      {/* ---------- Targets in effect ---------- */}
      {goals.length === 0 ? (
        <Card className="px-5 py-8 text-center text-sm text-fg-muted">
          Nothing planned yet. Set account-wide essentials above — every character is checked against them.
        </Card>
      ) : (
        byDomainTier.map(({ domain: d, tiers }) => (
          <section key={d} className="mb-6">
            <SectionTitle>{DOMAIN_LABEL[d]}</SectionTitle>
            <div className="space-y-4">
              {tiers.map(({ tier: t, goals: tierGoals }) => (
                <div key={t}>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge tone={TIER_TONE[t]}>{TIER_LABEL[t]}</Badge>
                    <span className="text-xs text-fg-subtle">
                      {tierGoals.length} target{tierGoals.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {tierGoals.map((goal) => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        subjects={data.subjects}
                        indexes={{ lineIndex: data.lineIndex, abilityIndex: data.abilityIndex }}
                        roles={data.roles}
                        onDelete={async (id) => {
                          await fetch(`/api/goals/${encodeURIComponent(id)}`, { method: "DELETE" });
                          router.refresh();
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

function groupLines(lines: PlannerData["lines"]): { key: string; entries: PlannerData["lines"] }[] {
  const map = new Map<string, PlannerData["lines"]>();
  for (const l of lines) {
    const key = l.className ?? l.category;
    (map.get(key) ?? map.set(key, []).get(key)!).push(l);
  }
  return [...map.entries()].map(([key, entries]) => ({ key, entries }));
}

function LineChips({
  title,
  groups,
  selected,
  onToggle,
}: {
  title: string;
  groups: { key: string; entries: PlannerData["lines"] }[];
  selected: Set<string>;
  onToggle: (name: string) => void;
}) {
  if (groups.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{title}</div>
      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="mb-1 text-[11px] uppercase tracking-wider text-fg-subtle/80">{g.key}</div>
            <div className="flex flex-wrap gap-1.5">
              {g.entries.map((l) => (
                <Chip key={l.name} active={selected.has(l.name)} onClick={() => onToggle(l.name)} label={l.name} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  suffix,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  suffix?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title ?? label}
      onClick={onClick}
      className={`max-w-full rounded-full border px-2.5 py-1 text-xs transition ${
        active
          ? "border-accent/60 bg-accent-soft font-medium text-accent"
          : "border-border text-fg-muted hover:border-border-strong hover:text-fg"
      }`}
    >
      <span className="truncate">{label}</span>
      {suffix && <span className="ml-1.5 text-[10px] text-fg-subtle">{suffix}</span>}
    </button>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string; hidden?: boolean }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const visible = options.filter((o) => !o.hidden);
  return (
    <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-border bg-surface p-0.5">
      {visible.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-md px-2.5 py-1.5 text-sm transition ${
            value === o.id ? "bg-accent-soft font-medium text-accent" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}