"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, SlidersHorizontal, X } from "lucide-react";
import type { DailyTrackable } from "@/lib/party/daily-tracking";

export interface TodayRow {
  key: string;
  label: string;
  detail: string | null;
  /** done · ready (turn in) · accepted (picked up) · open · unknown */
  state: "done" | "ready" | "accepted" | "open" | "unknown";
}

const WORD: Record<TodayRow["state"], string> = {
  done: "Done",
  ready: "Turn in",
  accepted: "Picked up",
  open: "Open",
  unknown: "Unknown",
};
const TONE: Record<TodayRow["state"], string> = {
  done: "text-ok",
  ready: "text-info",
  accepted: "text-info",
  open: "text-fg-muted",
  unknown: "text-fg-subtle",
};

/**
 * Today's dailies, only the ones you track. The tracked list is an account
 * default; a character can keep its own.
 */
export function TodayPanel({
  characterId,
  characterName,
  rows,
  scanned,
  trackables,
  tracked: initialTracked,
  own: initialOwn,
}: {
  characterId: string;
  characterName: string;
  rows: TodayRow[];
  scanned: boolean;
  trackables: DailyTrackable[];
  tracked: string[];
  own: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initialTracked));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = rows.filter((r) => initialTracked.includes(r.key));
  const done = shown.filter((r) => r.state === "done").length;

  async function save(body: object) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/daily-tracking", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      setEditing(false);
      router.refresh();
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const groups = [...new Set(trackables.map((t) => t.group))];

  if (editing) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[12px] text-fg-muted">Choose what to track</p>
          <button type="button" onClick={() => setEditing(false)} aria-label="Close" className="text-fg-subtle hover:text-fg">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-64 space-y-2.5 overflow-y-auto pr-1">
          {groups.map((g) => (
            <fieldset key={g}>
              <legend className="mb-1 text-[11px] text-fg-subtle">{g}</legend>
              {trackables
                .filter((t) => t.group === g)
                .map((t) => (
                  <label key={t.key} className="flex cursor-pointer items-center gap-2 py-0.5 text-[13px] text-fg">
                    <input
                      type="checkbox"
                      checked={picked.has(t.key)}
                      onChange={(e) => {
                        const next = new Set(picked);
                        if (e.target.checked) next.add(t.key);
                        else next.delete(t.key);
                        setPicked(next);
                      }}
                      className="accent-[var(--accent)]"
                    />
                    {t.label}
                  </label>
                ))}
            </fieldset>
          ))}
        </div>
        {error ? <p className="mt-2 text-[12px] text-danger">{error}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => save({ scope: "account", keys: [...picked] })}
            className="rounded-lg bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-fg"
          >
            Save for every character
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => save({ scope: "character", characterId, keys: [...picked] })}
            className="rounded-lg border border-border px-2.5 py-1 text-[12px] text-fg hover:border-border-strong"
          >
            Only {characterName}
          </button>
          {initialOwn ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => save({ scope: "character", characterId, keys: null })}
              className="px-1 text-[12px] text-fg-subtle hover:text-fg"
            >
              Use the account default
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 text-[12px]">
        <span className="text-fg-subtle">
          {scanned && shown.length > 0 ? (
            <>
              <span className={done === shown.length ? "text-ok" : "text-fg"}>
                {done}/{shown.length}
              </span>{" "}
              done · {initialOwn ? `${characterName}'s list` : "account list"}
            </>
          ) : initialOwn ? (
            `${characterName}'s list`
          ) : (
            "Account list"
          )}
        </span>
        <button
          type="button"
          onClick={() => {
            setPicked(new Set(initialTracked));
            setEditing(true);
          }}
          className="inline-flex items-center gap-1 text-fg-subtle hover:text-fg"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> Choose
        </button>
      </div>
      {!scanned ? (
        <p className="text-[13px] text-fg-muted">Not logged out since the reset, so today&apos;s dailies are unknown.</p>
      ) : shown.length === 0 ? (
        <p className="text-[13px] text-fg-muted">Nothing tracked. Press Choose to pick dailies.</p>
      ) : (
        <ul className="max-h-[21rem] space-y-1 overflow-y-auto pr-1">
          {shown.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate text-fg">
                {r.label}
                {r.detail ? <span className="ml-1.5 text-[12px] text-fg-subtle">{r.detail}</span> : null}
              </span>
              <span className={`flex shrink-0 items-center gap-1 ${TONE[r.state]}`}>
                {r.state === "done" ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                {WORD[r.state]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
