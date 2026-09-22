"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Target } from "lucide-react";
import type { GoalScope, SkillLineChoice } from "@/lib/goals/types";
import { Modal } from "./modal";

export function AddGoalButton({
  lines,
  defaultScope,
  characterId,
  allowAccount,
  label = "Add goal",
}: {
  lines: SkillLineChoice[];
  defaultScope: GoalScope;
  characterId?: string | null;
  allowAccount?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg hover:border-accent/50 hover:bg-surface-2"
      >
        <Target className="h-4 w-4 text-accent" />
        {label}
      </button>
      {open && (
        <GoalEditorModal
          lines={lines}
          defaultScope={defaultScope}
          characterId={characterId ?? null}
          allowAccount={allowAccount ?? defaultScope === "account"}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function GoalEditorModal({
  lines,
  defaultScope,
  characterId,
  allowAccount,
  onClose,
}: {
  lines: SkillLineChoice[];
  defaultScope: GoalScope;
  characterId: string | null;
  allowAccount: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const grouped = useMemo(() => {
    const m = new Map<string, SkillLineChoice[]>();
    for (const l of lines) {
      const arr = m.get(l.category) ?? [];
      arr.push(l);
      m.set(l.category, arr);
    }
    return Array.from(m.entries());
  }, [lines]);

  const [scope, setScope] = useState<GoalScope>(defaultScope);
  const [lineName, setLineName] = useState(lines[0]?.name ?? "");
  const [targetRank, setTargetRank] = useState(7);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope,
          characterId: scope === "character" ? characterId : null,
          lineName,
          targetRank,
          note,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save goal.");
        return;
      }
      router.refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="New goal" onClose={onClose}>
      <p className="mb-4 text-sm text-fg-muted">
        A skill line rank from the last snapshot — Assault 7 for everyone, or Werewolf 10 on one toon. Stored only on
        this machine. Snapshot imports do not wipe goals.
      </p>
      {allowAccount && characterId && (
        <div className="mb-3 inline-flex rounded-lg border border-border bg-surface p-0.5">
          {(
            [
              ["character", "This character"],
              ["account", "Every character"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setScope(k)}
              className={`rounded-md px-2.5 py-1.5 text-sm ${
                scope === k ? "bg-accent text-accent-fg" : "text-fg-muted hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="block text-xs text-fg-subtle">
          Skill line
          <select
            value={lineName}
            onChange={(e) => setLineName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg focus:border-accent focus:outline-none"
          >
            {grouped.length === 0 ? (
              <option value="">No skill lines in the catalog yet</option>
            ) : (
              grouped.map(([cat, ls]) => (
                <optgroup key={cat} label={cat}>
                  {ls.map((l) => (
                    <option key={l.name} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              ))
            )}
          </select>
        </label>
        {grouped.length === 0 && (
          <label className="block text-xs text-fg-subtle">
            Line name
            <input
              value={lineName}
              onChange={(e) => setLineName(e.target.value)}
              placeholder="Assault"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
            />
          </label>
        )}
        <label className="block text-xs text-fg-subtle">
          Target rank
          <input
            type="number"
            min={1}
            max={50}
            value={targetRank}
            onChange={(e) => setTargetRank(Number(e.target.value))}
            className="mt-1 w-24 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg focus:border-accent focus:outline-none"
          />
        </label>
        <label className="block text-xs text-fg-subtle">
          Reason <span className="text-fg-subtle/70">(optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={120}
            placeholder="e.g. PvP campaign, werewolf grind"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !lineName.trim()}
          className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent-soft px-2.5 py-1.5 text-sm font-medium text-accent hover:bg-accent hover:text-accent-fg disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Save goal
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </Modal>
  );
}
