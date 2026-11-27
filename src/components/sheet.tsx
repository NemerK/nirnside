"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * A panel that slides in from the right, over the page, for focused edits
 * (setting a target) without losing your place in the grid behind it.
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
  variant = "side",
}: {
  /** "side" slides in from the right; "center" is a larger dialog for browsing. */
  variant?: "side" | "center";
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    // Leave focus where a field inside already took it (a search box with autoFocus).
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className={`fixed inset-0 z-[80] flex ${variant === "center" ? "items-center justify-center p-4 sm:p-8" : "justify-end"}`}>
      <button
        type="button"
        aria-label="Close"
        className="nirn-sheet-veil absolute inset-0 bg-[rgb(5_8_15/0.5)]"
        onClick={onClose}
      />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className={
          variant === "center"
            ? "nirn-dialog relative z-[81] flex h-[min(88vh,48rem)] w-full max-w-6xl flex-col rounded-2xl border border-border-strong bg-bg-elev shadow-[var(--shadow-pop)] focus:outline-none"
            : "nirn-sheet relative z-[81] flex h-full w-full max-w-md flex-col border-l border-border-strong bg-bg-elev shadow-[var(--shadow-pop)] focus:outline-none"
        }
      >
        <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-5">
          <div className="min-w-0">
            <h2 id="sheet-title" className="font-display text-2xl font-semibold leading-tight text-fg">
              {title}
            </h2>
            {subtitle ? <div className="mt-1 text-sm text-fg-muted">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-md p-2 text-fg-subtle hover:bg-surface-2 hover:text-fg"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className={`min-h-0 flex-1 px-6 py-5 ${variant === "center" ? "flex flex-col overflow-y-auto" : "overflow-y-auto"}`}>
          {children}
        </div>
        {footer ? <footer className="border-t border-border px-6 py-4">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
