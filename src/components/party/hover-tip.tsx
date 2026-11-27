"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * Shows a card while the pointer (or keyboard focus) is on its trigger.
 * Placed in fixed coordinates so card edges and scroll areas never clip it.
 */
export function HoverTip({
  tip,
  children,
  className = "",
  width = 288,
}: {
  tip: ReactNode;
  children: ReactNode;
  className?: string;
  width?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [at, setAt] = useState<{ left: number; top: number; above: boolean } | null>(null);

  function show() {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, r.left + r.width / 2 - width / 2));
    const above = r.bottom + 220 > window.innerHeight && r.top > 240;
    setAt({ left, top: above ? r.top - 8 : r.bottom + 8, above });
  }

  return (
    <span
      ref={ref}
      className={className}
      onMouseEnter={show}
      onMouseLeave={() => setAt(null)}
      onFocus={show}
      onBlur={() => setAt(null)}
    >
      {children}
      {at ? (
        <span
          role="tooltip"
          className="pointer-events-none fixed z-[60] block rounded-xl border border-border-strong bg-surface p-3 text-left text-[12.5px] leading-snug text-fg shadow-2xl shadow-black/50"
          style={{ left: at.left, top: at.top, width, transform: at.above ? "translateY(-100%)" : undefined }}
        >
          {tip}
        </span>
      ) : null}
    </span>
  );
}
