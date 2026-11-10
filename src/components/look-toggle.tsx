"use client";

import { LOOKS, type Look } from "@/lib/look";
import { useLook } from "./look-provider";

export function LookToggle({ compact }: { compact?: boolean }) {
  const { look, setLook, ready } = useLook();

  return (
    <div
      role="group"
      aria-label="App look"
      className={
        compact
          ? "inline-flex rounded-md border border-border bg-surface p-0.5"
          : "inline-flex w-full rounded-lg border border-border bg-surface p-1"
      }
    >
      {LOOKS.map((option) => {
        const active = ready && look === option.id;
        return (
          <button
            key={option.id}
            type="button"
            title={option.blurb}
            aria-pressed={active}
            onClick={() => setLook(option.id as Look)}
            className={
              compact
                ? `rounded px-2 py-1 text-[11px] font-medium transition ${
                    active ? "bg-accent-soft text-accent" : "text-fg-subtle hover:text-fg"
                  }`
                : `flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    active ? "bg-accent-soft text-accent" : "text-fg-muted hover:text-fg"
                  }`
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
