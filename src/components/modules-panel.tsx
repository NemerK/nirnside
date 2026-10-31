"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Card } from "./ui";
import type { ModuleDef } from "@/lib/modules";

/**
 * Setup → Modules: choose which parts of Nirnside you currently see. A module
 * turned off here disappears from the sidebar and the Home dashboard; its page
 * keeps working if you open it directly, and no data is ever deleted.
 */
export function ModulesPanel({ modules, disabled }: { modules: ModuleDef[]; disabled: string[] }) {
  const router = useRouter();
  const [off, setOff] = useState<Set<string>>(new Set(disabled));
  const [busy, setBusy] = useState(false);

  async function save(next: Set<string>) {
    setBusy(true);
    const prev = off;
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

  function toggle(id: string) {
    const next = new Set(off);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    save(next);
  }

  return (
    <Card className="p-5">
      <div className="mb-1 text-sm font-medium text-fg">Modules</div>
      <p className="mb-4 text-sm text-fg-muted">
        Turn off what you&apos;re done with. Hidden modules leave the sidebar and the Home dashboard — nothing is
        deleted, and the page still works if you open it directly.
      </p>
      <ul className="divide-y divide-border">
        {modules.map((m) => {
          const on = !off.has(m.id);
          return (
            <li key={m.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-fg">{m.label}</div>
                <div className="mt-0.5 text-xs text-fg-subtle">{m.description}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`Show ${m.label}`}
                disabled={busy}
                onClick={() => toggle(m.id)}
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
            </li>
          );
        })}
      </ul>
      {off.size > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => save(new Set())}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-fg-muted hover:text-fg disabled:opacity-60"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Show everything
        </button>
      )}
    </Card>
  );
}