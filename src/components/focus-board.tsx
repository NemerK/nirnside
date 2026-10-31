"use client";

import { useEffect, useState } from "react";import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, ShieldQuestion } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "./ui";

export interface FocusAreaOption {
  id: string;
  label: string;
  hint: string;
}

export interface FocusCharacterOption {
  id: string;
  name: string;
  lastSeen: number | null;
}

/**
 * The Focus dashboard chrome: pick the character, pick what you care about
 * right now, and the matching panels render below. The choices persist
 * locally per character, so switching back later restores the same view.
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
  /** Server-rendered panels in display order. */
  panels: { id: string; node: ReactNode }[];
}) {
  const router = useRouter();
  const [on, setOn] = useState<string[]>(areas);
  const [syncKey, setSyncKey] = useState(`${selectedId}:${areas.join(",")}`);
  const [busy, setBusy] = useState(false);

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

  return (
    <div>
      <Card className="mb-6 p-4">
        <div className="mb-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Character</div>
          <div className="flex flex-wrap gap-1.5">
            {characters.map((c) => {
              const active = c.id === selectedId;
              return (
                <Link
                  key={c.id}
                  href={`/focus?char=${encodeURIComponent(c.id)}`}
                  className={`rounded-md px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-accent-soft font-medium text-accent"
                      : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                  }`}
                >
                  {c.name}
                  {c.lastSeen == null && <span className="ml-1.5 text-xs text-fg-subtle">· new</span>}
                </Link>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              What do you care about right now?
            </span>
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-fg-subtle" />}
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
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-60 ${
                    active
                      ? "border-accent/60 bg-accent-soft font-medium text-accent"
                      : "border-border text-fg-muted hover:border-border-strong hover:text-fg"
                  }`}
                >
                  {active && <Check className="h-3.5 w-3.5" />}
                  {area.label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {!scanned && (
        <Card className="mb-6 flex items-start gap-3 border-accent/40 bg-accent-soft p-4">
          <ShieldQuestion className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div className="text-sm text-fg">
            <span className="font-medium">This character hasn&apos;t been snapshotted yet.</span> Panels below show
            unknown until you log this character out (or ReloadUI) with the addon. We show what we know and nothing
            more.
          </div>
        </Card>
      )}

      {panels.length === 0 ? (
        <Card className="px-4 py-8 text-center text-sm text-fg-muted">
          No areas selected — turn one of the chips above back on.
        </Card>
      ) : (
        panels.map((p) => <div key={p.id}>{p.node}</div>)
      )}
    </div>
  );
}