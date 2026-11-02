"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Goal, GoalTier } from "@/lib/goals/types";
import type { GoalCardView } from "@/lib/goals/views";
import { isExcludedLineName } from "@/lib/catalog/excluded";
import { isClassMasteryLineName } from "@/lib/skills/class-mastery";
import { editSkillLineRanks } from "@/lib/skills/line-cap";
import { Card } from "./ui";

type Scope = "account" | "role" | "class" | "character";
type Mode = "mandatory" | "extra";

export interface SkillLinePlannerLine {
  name: string;
  category: string;
  className: string | null;
  maxRank: number | null;
}

export interface SkillLinePlannerCharacter {
  id: string;
  name: string;
  className: string;
  ranks: { name: string; rank: number }[];
}

interface Draft {
  name: string;
  scope: Scope;
  scopeKey: string;
  mandatory: number;
  extra: number;
  id: string | null;
  dirty: boolean;
}

const GROUP_REST = ["guild", "world", "alliance war", "craft", "racial"];

function scopeValue(scope: Scope, key: string): string {
  if (scope === "account") return "account";
  return `${scope}:${encodeURIComponent(key)}`;
}

function parseScope(value: string): { scope: Scope; key: string } {
  if (value === "account") return { scope: "account", key: "" };
  const i = value.indexOf(":");
  const scope = value.slice(0, i) as Scope;
  return { scope, key: decodeURIComponent(value.slice(i + 1)) };
}

function lineKey(scope: Scope, scopeKey: string, name: string): string {
  return `${scope}:${encodeURIComponent(scopeKey)}:${name.trim().toLowerCase()}`;
}

function sameScope(goal: Goal, scope: Scope, scopeKey: string): boolean {
  if (goal.domain !== "skillline" || goal.scope !== scope) return false;
  if (scope === "account") return true;
  if (scope === "character") return goal.characterId === scopeKey;
  return (goal.scopeKey ?? "") === scopeKey;
}

/** Legacy single-rank rows: Essential is mandatory; Extra / Completionist is the upper rank. */
function storedRanks(goal: Goal | undefined): { mandatory: number; extra: number; id: string | null } {
  if (!goal) return { mandatory: 0, extra: 0, id: null };
  if (goal.extraRank > 0) return { mandatory: goal.targetRank, extra: goal.extraRank, id: goal.id };
  if (goal.tier === "optional" || goal.tier === "completionist") {
    return { mandatory: 0, extra: goal.targetRank, id: goal.id };
  }
  return { mandatory: goal.targetRank, extra: 0, id: goal.id };
}

function groupSort(key: string, classes: string[]): number {
  if (key.startsWith("class:")) {
    const name = key.slice("class:".length);
    const i = classes.findIndex((c) => c.toLowerCase() === name.toLowerCase());
    return 20 + (i < 0 ? 40 : i);
  }
  const cat = key.slice("cat:".length).toLowerCase();
  if (cat === "weapon") return 0;
  if (cat === "armor") return 10;
  const rest = GROUP_REST.indexOf(cat);
  return rest < 0 ? 90 : 40 + rest;
}

/**
 * Every skill line, with its expectation beside it. M paints mandatory, E paints
 * extra (only from the mandatory rank upward). Both save on their own.
 */
export function SkillLinePlanner({
  lines,
  roles,
  classes,
  characters,
  cards,
}: {
  lines: SkillLinePlannerLine[];
  roles: { id: string; name: string }[];
  classes: string[];
  characters: SkillLinePlannerCharacter[];
  cards: GoalCardView[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("mandatory");
  const modeRef = useRef<Mode>("mandatory");
  const [scope, setScope] = useState<Scope>("account");
  const [scopeKey, setScopeKey] = useState("");
  const [watchId, setWatchId] = useState("");
  const [focused, setFocused] = useState("");
  const [drafts, setDrafts] = useState<Map<string, Draft>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const pending = useRef(new Map<string, Draft>());
  const inflight = useRef(new Set<string>());
  const ids = useRef(new Map<string, string | null>());
  const digits = useRef("");
  const digitTimer = useRef(0);
  const refreshTimer = useRef(0);

  function chooseMode(next: Mode) {
    modeRef.current = next;
    digits.current = "";
    window.clearTimeout(digitTimer.current);
    setMode(next);
    setHint(next === "mandatory" ? null : "Extra only moves from the mandatory rank up.");
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        chooseMode("mandatory");
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        chooseMode("extra");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setDrafts((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map(prev);
      for (const [key, draft] of prev) {
        if (draft.dirty) continue;
        const goal = cards.find(
          (c) => sameScope(c.goal, draft.scope, draft.scopeKey) && c.goal.target.toLowerCase() === draft.name.toLowerCase(),
        )?.goal;
        const stored = storedRanks(goal);
        if (stored.mandatory === draft.mandatory && stored.extra === draft.extra && stored.id === draft.id) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [cards]);

  useEffect(() => {
    return () => {
      window.clearTimeout(digitTimer.current);
      window.clearTimeout(refreshTimer.current);
    };
  }, []);

  const watched = characters.find((c) => c.id === watchId) ?? null;
  const characterClass =
    scope === "character" ? (characters.find((c) => c.id === scopeKey)?.className ?? null) : null;

  const groups = useMemo(() => {
    const visible = lines.filter((line) => {
      if (isClassMasteryLineName(line.name) || isExcludedLineName(line.name)) return false;
      if (line.maxRank == null || line.maxRank < 1) return false;
      if (line.category.toLowerCase() !== "class") return true;
      if (scope === "class") return (line.className ?? "").toLowerCase() === scopeKey.toLowerCase();
      if (scope === "character" && characterClass) {
        return (line.className ?? "").toLowerCase() === characterClass.toLowerCase();
      }
      return true;
    });
    const byKey = new Map<string, SkillLinePlannerLine[]>();
    for (const line of visible) {
      const key =
        line.category.toLowerCase() === "class"
          ? `class:${line.className ?? "Class"}`
          : `cat:${line.category}`;
      const arr = byKey.get(key);
      if (arr) arr.push(line);
      else byKey.set(key, [line]);
    }
    return [...byKey.entries()]
      .sort((a, b) => groupSort(a[0], classes) - groupSort(b[0], classes) || a[0].localeCompare(b[0]))
      .map(([key, entries]) => ({
        key,
        title: key.startsWith("class:") ? key.slice("class:".length) : key.slice("cat:".length),
        entries: entries.sort((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [lines, classes, scope, scopeKey, characterClass]);

  const unknown = useMemo(
    () =>
      lines.filter(
        (line) =>
          !isClassMasteryLineName(line.name) &&
          !isExcludedLineName(line.name) &&
          (line.maxRank == null || line.maxRank < 1),
      ),
    [lines],
  );

  function serverDraft(line: SkillLinePlannerLine): Draft {
    const goal = cards.find(
      (c) => sameScope(c.goal, scope, scopeKey) && c.goal.target.toLowerCase() === line.name.toLowerCase(),
    )?.goal;
    const stored = storedRanks(goal);
    return {
      name: line.name,
      scope,
      scopeKey,
      mandatory: stored.mandatory,
      extra: stored.extra,
      id: stored.id,
      dirty: false,
    };
  }

  function shown(line: SkillLinePlannerLine): Draft {
    const key = lineKey(scope, scopeKey, line.name);
    return drafts.get(key) ?? serverDraft(line);
  }

  function scheduleRefresh() {
    window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => router.refresh(), 350);
  }

  async function persist(snap: Draft): Promise<{ id: string | null }> {
    const key = lineKey(snap.scope, snap.scopeKey, snap.name);
    const id = ids.current.has(key) ? ids.current.get(key)! : snap.id;
    if (snap.mandatory === 0 && snap.extra === 0) {
      if (!id) return { id: null };
      const res = await fetch(`/api/goals/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? "Could not clear that rank.");
      }
      ids.current.set(key, null);
      return { id: null };
    }
    const tier: GoalTier = snap.mandatory > 0 ? "essential" : "optional";
    const body = { targetRank: snap.mandatory, extraRank: snap.extra, tier };
    if (id) {
      const res = await fetch(`/api/goals/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save.");
      ids.current.set(key, id);
      return { id };
    }
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        domain: "skillline",
        scope: snap.scope,
        characterId: snap.scope === "character" ? snap.scopeKey : null,
        scopeKey: snap.scope === "role" || snap.scope === "class" ? snap.scopeKey : null,
        target: snap.name,
        ...body,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      created?: string[];
      goals?: Goal[];
    };
    if (!res.ok) {
      const existing = json.goals?.find(
        (g) => sameScope(g, snap.scope, snap.scopeKey) && g.target.toLowerCase() === snap.name.toLowerCase(),
      );
      if (existing) {
        ids.current.set(key, existing.id);
        return persist({ ...snap, id: existing.id });
      }
      throw new Error(json.error ?? "Could not save.");
    }
    const created = json.created?.[0] ?? null;
    ids.current.set(key, created);
    return { id: created };
  }

  function drain(key: string) {
    if (inflight.current.has(key)) return;
    inflight.current.add(key);
    void (async () => {
      try {
        while (pending.current.has(key)) {
          const snap = pending.current.get(key)!;
          pending.current.delete(key);
          const saved = await persist(snap);
          setDrafts((prev) => {
            const cur = prev.get(key);
            if (!cur) return prev;
            const next = new Map(prev);
            const same = cur.mandatory === snap.mandatory && cur.extra === snap.extra;
            next.set(key, {
              ...cur,
              id: saved.id,
              dirty: !same || pending.current.has(key),
            });
            return next;
          });
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save.");
        setDrafts((prev) => {
          const cur = prev.get(key);
          if (!cur) return prev;
          const next = new Map(prev);
          next.set(key, { ...cur, dirty: pending.current.has(key) });
          return next;
        });
      } finally {
        inflight.current.delete(key);
        if (pending.current.has(key)) drain(key);
        else scheduleRefresh();
      }
    })();
  }

  function commit(line: SkillLinePlannerLine, ranks: { mandatory: number; extra: number }) {
    const key = lineKey(scope, scopeKey, line.name);
    const prev = drafts.get(key) ?? serverDraft(line);
    const id = ids.current.has(key) ? ids.current.get(key)! : prev.id;
    const draft: Draft = {
      name: line.name,
      scope,
      scopeKey,
      mandatory: ranks.mandatory,
      extra: ranks.extra,
      id,
      dirty: true,
    };
    setDrafts((map) => {
      const next = new Map(map);
      next.set(key, draft);
      return next;
    });
    pending.current.set(key, draft);
    drain(key);
  }

  function applyRaw(line: SkillLinePlannerLine, raw: number) {
    const cap = line.maxRank ?? 0;
    if (cap < 1) return;
    const current = shown(line);
    const modeNow = modeRef.current;
    if (modeNow === "extra" && raw < current.mandatory) {
      setHint(`Extra stays at ${current.mandatory} or above on ${line.name}.`);
      return;
    }
    setHint(null);
    commit(line, editSkillLineRanks(modeNow, cap, current.mandatory, current.extra, raw));
  }

  function flushDigits(line: SkillLinePlannerLine) {
    window.clearTimeout(digitTimer.current);
    const raw = digits.current;
    digits.current = "";
    if (!raw) return;
    applyRaw(line, Number.parseInt(raw, 10));
  }

  const saving = [...drafts.values()].some((d) => d.dirty);

  return (
    <Card>
      <div className="sticky top-0 z-10 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Which rank to set">
            <ModeButton
              pressed={mode === "mandatory"}
              onClick={() => chooseMode("mandatory")}
              swatch="var(--rank-mandatory)"
              kbd="M"
              label="Mandatory"
            />
            <ModeButton
              pressed={mode === "extra"}
              onClick={() => chooseMode("extra")}
              swatch="var(--rank-extra)"
              kbd="E"
              label="Extra"
            />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-fg-subtle">
            for
            <select
              value={scopeValue(scope, scopeKey)}
              onChange={(e) => {
                const next = parseScope(e.target.value);
                setScope(next.scope);
                setScopeKey(next.key);
              }}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-fg focus:border-accent focus:outline-none"
            >
              <option value="account">Everyone</option>
              {roles.length > 0 && (
                <optgroup label="Roles">
                  {roles.map((r) => (
                    <option key={r.id} value={scopeValue("role", r.id)}>
                      {r.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Classes">
                {classes.map((c) => (
                  <option key={c} value={scopeValue("class", c)}>
                    {c}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Characters">
                {characters.map((c) => (
                  <option key={c.id} value={scopeValue("character", c.id)}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-fg-subtle">
            show
            <select
              value={watchId}
              onChange={(e) => setWatchId(e.target.value)}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-fg focus:border-accent focus:outline-none"
            >
              <option value="">No character mark</option>
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <span className="ml-auto text-xs text-fg-subtle">{saving ? "Saving…" : "Saves as you move the bar"}</span>
        </div>
        <p className="mt-2 text-xs text-fg-muted">
          {mode === "mandatory"
            ? "Mandatory is the rank you actually want. Click a line, drag, or type the number."
            : "Extra sits above mandatory and cannot move below it. Press M to go back."}
          {hint ? <span className="ml-2 text-fg">{hint}</span> : null}
        </p>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      <div>
        {groups.map((group) => (
          <section key={group.key}>
            <h3 className="bg-surface/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
              {group.title}
            </h3>
            <ul>
              {group.entries.map((line) => {
                const cap = line.maxRank ?? 0;
                const draft = shown(line);
                const key = lineKey(scope, scopeKey, line.name);
                const current = watched?.ranks.find((r) => r.name.toLowerCase() === line.name.toLowerCase())?.rank;
                return (
                  <li key={line.name} className="border-t border-border/50">
                    <LineBar
                      line={line}
                      cap={cap}
                      mandatory={draft.mandatory}
                      extra={draft.extra}
                      focused={focused === key}
                      current={current}
                      mode={mode}
                      onFocus={() => {
                        digits.current = "";
                        setFocused(key);
                      }}
                      onPaint={(raw) => applyRaw(line, raw)}
                      onKeyDown={(e) => {
                        const currentEdge =
                          modeRef.current === "mandatory"
                            ? draft.mandatory
                            : draft.extra > draft.mandatory
                              ? draft.extra
                              : draft.mandatory;
                        if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                          e.preventDefault();
                          applyRaw(line, currentEdge - 1);
                        } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                          e.preventDefault();
                          applyRaw(line, currentEdge + 1);
                        } else if (e.key === "Home") {
                          e.preventDefault();
                          applyRaw(line, modeRef.current === "extra" ? draft.mandatory : 0);
                        } else if (e.key === "End") {
                          e.preventDefault();
                          applyRaw(line, cap);
                        } else if (e.key === "Backspace") {
                          digits.current = digits.current.slice(0, -1);
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          flushDigits(line);
                        } else if (/^\d$/.test(e.key)) {
                          e.preventDefault();
                          digits.current += e.key;
                          const n = Number.parseInt(digits.current, 10);
                          if (n * 10 > cap) flushDigits(line);
                          else {
                            window.clearTimeout(digitTimer.current);
                            digitTimer.current = window.setTimeout(() => flushDigits(line), 700);
                          }
                        }
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {groups.length === 0 && (
          <p className="px-4 py-6 text-sm text-fg-muted">No rankable skill lines for this choice.</p>
        )}
        <p className="border-t border-border/60 px-4 py-2 text-xs text-fg-subtle">
          Class Mastery is bought with points, not a rank, so it is not on this list.
          {unknown.length > 0
            ? ` Rank cap not confirmed, so not set here: ${unknown.map((l) => l.name).join(", ")}.`
            : ""}
        </p>
      </div>
    </Card>
  );
}

function ModeButton({
  pressed,
  onClick,
  swatch,
  kbd,
  label,
}: {
  pressed: boolean;
  onClick: () => void;
  swatch: string;
  kbd: string;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm ${
        pressed ? "bg-surface-2 font-medium text-fg" : "text-fg-muted hover:text-fg"
      }`}
    >
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: swatch }} aria-hidden />
      <kbd className="rounded border border-border px-1 font-mono text-[10px] text-fg-subtle">{kbd}</kbd>
      {label}
    </button>
  );
}

function LineBar({
  line,
  cap,
  mandatory,
  extra,
  focused,
  current,
  mode,
  onFocus,
  onPaint,
  onKeyDown,
}: {
  line: SkillLinePlannerLine;
  cap: number;
  mandatory: number;
  extra: number;
  focused: boolean;
  current: number | undefined;
  mode: Mode;
  onFocus: () => void;
  onPaint: (rank: number) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const value = mode === "mandatory" ? mandatory : extra > mandatory ? extra : mandatory;
  const mandatoryPct = cap > 0 ? (mandatory / cap) * 100 : 0;
  const extraPct = cap > 0 && extra > mandatory ? ((extra - mandatory) / cap) * 100 : 0;
  const markPct = current == null || cap <= 0 ? null : (Math.min(Math.max(current, 0), cap) / cap) * 100;

  function rankAt(e: React.PointerEvent<HTMLDivElement>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = rect.width <= 0 ? 0 : (e.clientX - rect.left) / rect.width;
    return Math.round(Math.min(1, Math.max(0, ratio)) * cap);
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 ${focused ? "bg-surface/80" : ""}`}>
      <div className="min-w-0 w-full sm:w-44">
        <div className="truncate text-sm text-fg">{line.name}</div>
        {current != null ? (
          <div className="text-[11px] tabular-nums text-fg-subtle">Now {current}</div>
        ) : line.className ? (
          <div className="truncate text-[11px] text-fg-subtle">{line.className}</div>
        ) : null}
      </div>
      <div
        role="slider"
        tabIndex={0}
        aria-valuemin={mode === "extra" ? mandatory : 0}
        aria-valuemax={cap}
        aria-valuenow={value}
        aria-valuetext={
          extra > mandatory ? `Mandatory ${mandatory}, extra ${extra}, cap ${cap}` : `Mandatory ${mandatory}, cap ${cap}`
        }
        aria-label={`${line.name} ${mode} rank`}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onPointerDown={(e) => {
          e.currentTarget.focus();
          onFocus();
          e.currentTarget.setPointerCapture(e.pointerId);
          onPaint(rankAt(e));
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          onPaint(rankAt(e));
        }}
        className="relative h-8 min-w-[12rem] flex-1 cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full bg-surface-2">
          {mandatory > 0 && (
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${mandatoryPct}%`, background: "var(--rank-mandatory)" }}
            />
          )}
          {extra > mandatory && (
            <div
              className="absolute inset-y-0"
              style={{
                left: `${mandatoryPct}%`,
                width: `${extraPct}%`,
                background: "var(--rank-extra)",
              }}
            />
          )}
        </div>
        {markPct != null && (
          <div
            className="absolute top-1 bottom-1 w-0.5 bg-fg"
            style={{ left: `${markPct}%` }}
            title={current != null ? `Current rank ${current}` : undefined}
          />
        )}
      </div>
      <div className="w-[5.5rem] shrink-0 text-right text-sm tabular-nums">
        {mandatory > 0 ? (
          <span style={{ color: "var(--rank-mandatory)" }}>{mandatory}</span>
        ) : (
          <span className="text-fg-subtle">–</span>
        )}
        {extra > mandatory ? <span style={{ color: "var(--rank-extra)" }}>–{extra}</span> : null}
        <span className="text-fg-subtle"> / {cap}</span>
      </div>
    </div>
  );
}
