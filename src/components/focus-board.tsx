"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Settings2, ShieldQuestion } from "lucide-react";
import { Card } from "./ui";

export interface FocusAreaOption {
  id: string;
  label: string;
  hint: string;
}

export interface FocusCharacterOption {
  id: string;
  name: string;
  className: string;
  lastSeen: number | null;
}

export interface FocusPanel {
  id: string;
  title: string;
  /** One-line count shown next to the title, e.g. "Research 214/324". */
  summary?: string;
  node: ReactNode;
}

/**
 * The Focus dashboard: pick a character, get their world at a glance.
 * Sections are collapsible cards with one-line summaries — the overview is
 * readable without touching anything. The per-character section picker hides
 * behind "Customize" and remembers your choice.
 */
export function FocusBoard({
  characters,
  selectedId,
  scanned,
  areas,
  areaOptions,
  panels,
}: {
  characters: FocusCharacterOption[];
  selectedId: string;
  /** Whether the focused character has ever been snapshotted. */
  scanned: boolean;
  /** Enabled area ids for the focused character. */
  areas: string[];
  areaOptions: FocusAreaOption[];
  /** Server-rendered panels in display order, with titles and summaries. */
  panels: FocusPanel[];
}) {
  const router = useRouter();
  const [on, setOn] = useState<string[]>(areas);
  const [busy, setBusy] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [syncKey, setSyncKey] = useState(`${selectedId}:${areas.join(",")}`);

  // The server owns the truth (areas persist per character). Re-sync the local
  // optimistic state whenever the selection actually changes — during render,
  // so there is no extra effects pass.
  const nextKey = `${selectedId}:${areas.join(",")}`;
  if (syncKey !== nextKey) {
    setSyncKey(nextKey);
    setOn(areas);
  }

  // Remember the last focused character so a bare /focus reopens it.
  useEffect(() => {
    fetch("/api/focus", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ char: selectedId }),
    }).catch(() => {});
  }, [selectedId]);

  async function toggleArea(id: string) {
    const next = on.includes(id) ? on.filter((a) => a !== id) : [...on, id];
    setOn(next);
    setBusy(true);
    try {
      const res = await fetch("/api/focus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterId: selectedId, areas: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const firstWithSummary = panels.findIndex((p) => p.summary !== undefined);
  const defaultOpen = firstWithSummary === -1 ? 0 : firstWithSummary;

  return (
    <div>
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">Character</div>
          <button
            type="button"
            onClick={() => setCustomizing((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
              customizing
                ? "border-accent/60 bg-accent-soft text-accent"
                : "border-border text-fg-muted hover:text-fg"
            }`}
          >
            <Settings2 className="h-3.5 w-3.5" />
            Customize sections
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {characters.map((c) => {
            const active = c.id === selectedId;
            return (
              <Link
                key={c.id}
                href={`/focus?char=${encodeURIComponent(c.id)}`}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {c.name}
                <span className={`ml-1.5 text-xs ${active ? "text-accent/70" : "text-fg-subtle"}`}>{c.className}</span>
                {c.lastSeen == null && <span className="ml-1.5 text-xs text-fg-subtle">· new</span>}
              </Link>
            );
          })}
        </div>

        {customizing && (
          <div className="mt-3 border-t border-border pt-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs text-fg-subtle">Sections for this character</span>
              {busy && <span className="text-xs text-fg-subtle">saving…</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {areaOptions.map((area) => {
                const active = on.includes(area.id);
                return (
                  <button
                    key={area.id}
                    type="button"
                    aria-pressed={active}
                    disabled={busy}
                    onClick={() => toggleArea(area.id)}
                    title={area.hint}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition disabled:opacity-60 ${
                      active
                        ? "border-accent/60 bg-accent-soft font-medium text-accent"
                        : "border-border text-fg-muted hover:border-border-strong hover:text-fg"
                    }`}
                  >
                    {area.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {!scanned && (
        <Card className="mb-4 flex items-start gap-3 border-accent/40 bg-accent-soft p-4">
          <ShieldQuestion className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div className="text-sm text-fg">
            <span className="font-medium">This character hasn&apos;t been snapshotted yet.</span> Sections below show
            unknown until you log this character out (or ReloadUI) with the addon. We show what we know and nothing
            more.
          </div>
        </Card>
      )}

      {panels.length === 0 ? (
        <Card className="px-4 py-8 text-center text-sm text-fg-muted">
          No sections selected — open <span className="text-accent">Customize sections</span> above and turn one back on.
        </Card>
      ) : (
        panels.map((panel, i) => (
          <details key={panel.id} open={i === defaultOpen} className="focus-panel">
            <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-surface/70 px-4 py-3 transition hover:border-accent/40">
              <span className="flex items-center gap-2.5">
                <ChevronDown className="chev h-4 w-4 text-accent" />
                <span className="text-sm font-semibold uppercase tracking-wider text-fg-subtle">{panel.title}</span>
              </span>
              {panel.summary && <span className="text-xs tabular-nums text-fg-muted">{panel.summary}</span>}
            </summary>
            <div className="pb-4">{panel.node}</div>
          </details>
        ))
      )}
    </div>
  );
}