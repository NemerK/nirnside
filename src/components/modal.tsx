"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  maxWidthClass = "max-w-lg",
  stable = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidthClass?: string;
  /** One frame sized for the largest pane, so switching content does not resize the dialog. */
  stable?: boolean;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex justify-center p-4 ${
        stable ? "items-center overflow-hidden" : "items-start overflow-y-auto sm:items-center"
      }`}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative z-[81] flex w-full flex-col rounded-xl border border-border bg-bg-elev shadow-2xl ${maxWidthClass} ${
          stable ? "h-[min(46rem,calc(100dvh-2rem))]" : "my-8"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="modal-title" className="truncate text-lg font-semibold text-fg">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 truncate text-sm text-fg-muted">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className={stable ? "flex min-h-0 flex-1 flex-col px-5 py-4" : "px-5 py-4"}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
