"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { Role } from "@/lib/roles/types";
import { SUGGESTED_ROLES } from "@/lib/roles/types";
import { Card, SectionTitle } from "./ui";
import { RoleBadge } from "./role-badge";

export function RoleManager({ roles }: { roles: Role[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#c8a35a");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const existing = new Set(roles.map((r) => r.name.toLowerCase()));
  const suggestions = SUGGESTED_ROLES.filter((s) => !existing.has(s.name.toLowerCase()));

  async function create(nextName: string, nextColor: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: nextName, color: nextColor }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not create role.");
        return;
      }
      setName("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/roles/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) setError(data.error ?? "Could not delete role.");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function recolor(id: string, next: string) {
    await fetch(`/api/roles/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ color: next }),
    });
    router.refresh();
  }

  return (
    <Card className="mb-6 p-4">
      <SectionTitle>Roles</SectionTitle>
      <p className="mb-3 text-sm text-fg-muted">
        Your labels, stored only on this machine. Create a role, then assign it on any character. Snapshot imports
        do not wipe them.
      </p>
      {roles.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {roles.map((r) => (
            <li key={r.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2/50 px-2 py-1">
              <label className="relative h-4 w-4 overflow-hidden rounded-full border border-border" title="Change color">
                <span className="absolute inset-0" style={{ background: r.color }} />
                <input
                  type="color"
                  value={r.color}
                  onChange={(e) => recolor(r.id, e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label={`Color for ${r.name}`}
                />
              </label>
              <RoleBadge role={r} />
              <button
                type="button"
                onClick={() => remove(r.id)}
                className="rounded p-0.5 text-fg-subtle hover:text-danger"
                aria-label={`Delete ${r.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          create(name, color);
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Role name"
          maxLength={32}
          className="w-40 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
        />
        <label className="flex items-center gap-1.5 text-xs text-fg-muted">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border border-border bg-surface"
          />
          Color
        </label>
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-1 rounded-lg border border-accent/40 bg-accent-soft px-2.5 py-1.5 text-sm font-medium text-accent hover:bg-accent hover:text-accent-fg disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Create
        </button>
        {suggestions.map((s) => (
          <button
            key={s.name}
            type="button"
            disabled={busy}
            onClick={() => create(s.name, s.color)}
            className="rounded-lg border border-border px-2 py-1.5 text-xs text-fg-muted hover:text-fg"
          >
            + {s.name}
          </button>
        ))}
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Card>
  );
}
