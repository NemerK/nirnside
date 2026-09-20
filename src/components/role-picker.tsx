"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { Role } from "@/lib/roles/types";
import { RoleBadge } from "./role-badge";

export function RolePicker({
  characterId,
  role,
  roles,
}: {
  characterId: string;
  role: Role | null;
  roles: Role[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  async function pick(roleId: string | null) {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/character-role", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterId, roleId }),
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
        className="inline-flex max-w-full items-center gap-1 rounded-md text-left disabled:opacity-60"
        aria-haspopup="listbox"
        aria-expanded={open}
        title={role ? `Role: ${role.name}` : "Assign a role"}
      >
        {role ? (
          <RoleBadge role={role} />
        ) : (
          <span className="inline-flex items-center rounded-md border border-dashed border-border px-1.5 py-0.5 text-xs text-fg-subtle hover:border-accent/50 hover:text-fg-muted">
            Assign role
          </span>
        )}
        <ChevronDown className="h-3 w-3 text-fg-subtle" />
      </button>
      {open && (
        <div
          className="absolute left-0 z-30 mt-1 min-w-[11rem] overflow-hidden rounded-lg border border-border bg-bg-elev py-1 shadow-lg"
          role="listbox"
        >
          {roles.length === 0 ? (
            <div className="px-3 py-2 text-xs text-fg-muted">Create a role first, then assign it here.</div>
          ) : (
            roles.map((r) => (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={role?.id === r.id}
                onClick={() => pick(r.id)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-surface-2 ${
                  role?.id === r.id ? "bg-surface-2" : ""
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                <span className="text-fg">{r.name}</span>
              </button>
            ))
          )}
          {role && (
            <button
              type="button"
              onClick={() => pick(null)}
              className="flex w-full border-t border-border px-3 py-1.5 text-left text-xs text-fg-muted hover:bg-surface-2 hover:text-fg"
            >
              Clear role
            </button>
          )}
        </div>
      )}
    </div>
  );
}
