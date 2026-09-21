"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import type { Role } from "@/lib/roles/types";
import { RoleBadge } from "./role-badge";

export function RolePicker({
  characterId,
  assigned,
  roles,
}: {
  characterId: string;
  assigned: Role[];
  roles: Role[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const assignedIds = new Set(assigned.map((r) => r.id));

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [open]);

  async function toggle(roleId: string, next: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/character-role", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterId, roleId, assigned: next }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/character-role", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterId, roleId: null }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={busy}
        className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-md text-left disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-multiselectable="true"
        title={assigned.length > 0 ? `Roles: ${assigned.map((r) => r.name).join(", ")}` : "Assign roles"}
      >
        {assigned.length > 0 ? (
          assigned.map((r) => <RoleBadge key={r.id} role={r} />)
        ) : (
          <span className="inline-flex items-center rounded-md border border-dashed border-border px-1.5 py-0.5 text-xs text-fg-subtle hover:border-accent/50 hover:text-fg-muted">
            Assign roles
          </span>
        )}
        <ChevronDown className="h-3 w-3 text-fg-subtle" />
      </button>
      {open && (
        <div
          className="absolute left-0 z-50 mt-1 min-w-[12rem] overflow-hidden rounded-lg border border-border bg-bg-elev py-1 shadow-lg"
          role="listbox"
          aria-multiselectable="true"
          onMouseDown={(e) => e.preventDefault()}
        >
          {roles.length === 0 ? (
            <div className="px-3 py-2 text-xs text-fg-muted">Create a role first, then assign it here.</div>
          ) : (
            roles.map((r) => {
              const on = assignedIds.has(r.id);
              return (
                <button
                  key={r.id}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => toggle(r.id, !on)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-2 ${
                    on ? "bg-surface-2" : ""
                  }`}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border">
                    {on && <Check className="h-3 w-3 text-accent" />}
                  </span>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                  <span className="text-fg">{r.name}</span>
                </button>
              );
            })
          )}
          {assigned.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="flex w-full border-t border-border px-3 py-1.5 text-left text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              Clear roles
            </button>
          )}
        </div>
      )}
    </div>
  );
}
