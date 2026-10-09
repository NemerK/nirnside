"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const assignedIds = new Set(assigned.map((r) => r.id));

  function placeMenu() {
    const btn = root.current?.querySelector("button");
    const el = menu.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const h = el?.offsetHeight ?? 220;
    const w = Math.max(el?.offsetWidth ?? 192, 192);
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
    let left = r.left;
    if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8);
    setPos({ top, left });
  }

  useLayoutEffect(() => {
    if (!open) return;
    placeMenu();
    function onReposition() {
      placeMenu();
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, roles.length, assigned.length]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (root.current?.contains(t) || menu.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
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

  const menuEl = open ? (
    <div
      ref={menu}
      className="fixed z-[70] min-w-[12rem] overflow-hidden rounded-lg border border-border bg-bg-elev py-1 shadow-lg"
      style={{ top: pos.top, left: pos.left }}
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
  ) : null;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          const btn = root.current?.querySelector("button");
          if (btn) {
            const r = btn.getBoundingClientRect();
            setPos({ top: r.bottom + 4, left: r.left });
          }
          setOpen(true);
        }}
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
      {menuEl && typeof document !== "undefined" ? createPortal(menuEl, document.body) : null}
    </div>
  );
}
