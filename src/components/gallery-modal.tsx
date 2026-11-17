"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { GalleryBoard } from "@/components/gallery-board";
import type { GalleryKind } from "@/lib/gallery/rules";

export function GalleryModal({
  kind,
  ownerId,
  title,
  detail,
  onClose,
}: {
  kind: GalleryKind;
  ownerId: string;
  title: string;
  detail: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const [photos, setPhotos] = useState<{ id: string }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (document.querySelector("[data-gallery-photo]")) return;
      onClose();
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    const controller = new AbortController();
    const url = `/api/gallery/${kind}/${encodeURIComponent(ownerId)}`;
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as { photos?: { id: string }[]; error?: string } | null;
        if (!res.ok) throw new Error(payload?.error || "Could not open this gallery.");
        setPhotos(payload?.photos ?? []);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Could not open this gallery.");
      });
    return () => controller.abort();
  }, [kind, ownerId]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="nirn-gallery-veil fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-6">
      <button type="button" aria-label="Close gallery" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="nirn-gallery-sheet relative z-[81] flex max-h-[min(42rem,calc(100vh-1.5rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-bg-elev shadow-2xl sm:max-h-[min(42rem,calc(100vh-3rem))]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-semibold text-fg">
              {title}
            </h2>
            <p className="mt-0.5 text-sm text-fg-muted">
              {detail}. Photos stay on this computer and are not part of a snapshot.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-fg-subtle hover:bg-surface-2 hover:text-fg"
            aria-label="Close gallery"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? <p className="text-sm text-amber-600 dark:text-amber-400">{error}</p> : null}
          {photos ? (
            <GalleryBoard kind={kind} ownerId={ownerId} photos={photos} />
          ) : error ? null : (
            <p className="py-10 text-center text-sm text-fg-muted">Opening gallery…</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
