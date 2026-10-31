"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Backpack,
  BookMarked,
  BookOpen,
  CalendarDays,
  Crosshair,
  Landmark,
  Library,
  ListChecks,
  Settings2,
  Shirt,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Modal } from "./modal";
import { NirnsideMark } from "./nirnside-mark";
import type { ModuleDef } from "@/lib/modules";

const MODULE_ICONS: Record<string, LucideIcon> = {
  focus: Crosshair,
  planner: ListChecks,
  characters: Users,
  inventory: Backpack,
  stickerbook: BookMarked,
  knowledge: BookOpen,
  styles: Shirt,
  dailies: CalendarDays,
  houses: Landmark,
  achievements: Trophy,
  encyclopedia: Library,
};

/**
 * The "Nirnside settings" button: one place to choose what the app shows.
 * Turning a module off only hides it (sidebar + Home) — nothing is deleted and
 * the page keeps working at its URL.
 */
export function NirnsideSettings({
  modules,
  hiddenModules,
  compact,
}: {
  modules: ModuleDef[];
  hiddenModules: string[];
  /** In the sidebar footer render a quiet icon button; elsewhere a labeled one. */
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [off, setOff] = useState<Set<string>>(new Set(hiddenModules));
  const [busy, setBusy] = useState(false);

  async function toggle(id: string) {
    setBusy(true);
    const prev = off;
    const next = new Set(off);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOff(next);
    try {
      const res = await fetch("/api/modules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ disabled: [...next] }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setOff(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Nirnside settings"
        title="Nirnside settings — choose what the app shows"
        className={
          compact
            ? "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-fg-muted transition hover:border-accent/50 hover:text-accent"
            : "inline-flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-fg-muted transition hover:border-accent/50 hover:text-accent"
        }
      >
        <Settings2 className="h-4 w-4 shrink-0" />
        {!compact && <span>Nirnside settings</span>}
      </button>

      {open && (
        <Modal title="Nirnside settings" onClose={() => setOpen(false)} maxWidthClass="max-w-xl">
          <div className="mb-4 flex items-center gap-3">
            <NirnsideMark className="h-9 w-9 shrink-0 rounded-lg" />
            <p className="text-sm text-fg-muted">
              Choose what Nirnside shows you. Hidden modules leave the sidebar and the Home dashboard — nothing is
              deleted, and the page still works if you open it directly.
            </p>
          </div>
          <ul className="divide-y divide-border/70">
            {modules.map((m) => {
              const Icon = MODULE_ICONS[m.id] ?? Settings2;
              const on = !off.has(m.id);
              return (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition ${
                      on ? "border-accent/30 bg-accent-soft text-accent" : "border-border bg-surface-2 text-fg-subtle"
                    }`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-fg">{m.label}</div>
                    <div className="mt-0.5 truncate text-xs text-fg-subtle" title={m.description}>
                      {m.description}
                    </div>
                  </div>
                  <Switch on={on} busy={busy} onClick={() => toggle(m.id)} label={`Show ${m.label}`} />
                </li>
              );
            })}
          </ul>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
            <p className="text-xs text-fg-subtle">
              {off.size > 0 ? `${off.size} module${off.size === 1 ? "" : "s"} hidden` : "Everything is shown"}
            </p>
            <Link href="/setup" className="text-xs text-accent hover:underline" onClick={() => setOpen(false)}>
              Full Setup →
            </Link>
          </div>
        </Modal>
      )}
    </>
  );
}

function Switch({ on, busy, onClick, label }: { on: boolean; busy: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-60 ${
        on ? "border-accent/60 bg-accent" : "border-border bg-surface-2"
      }`}
    >
      <span
        className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-bg transition-all ${
          on ? "left-[1.45rem]" : "left-0.5"
        }`}
      />
    </button>
  );
}