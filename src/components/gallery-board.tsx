"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, X } from "lucide-react";
import { GALLERY_MAX_BYTES, GALLERY_MAX_PHOTOS, type GalleryKind } from "@/lib/gallery/rules";

export function GalleryBoard({
  kind,
  ownerId,
  photos,
}: {
  kind: GalleryKind;
  ownerId: string;
  photos: { id: string }[];
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const full = photos.length >= GALLERY_MAX_PHOTOS;

  function url(photoId: string) {
    return `/api/gallery/${kind}/${encodeURIComponent(ownerId)}/${photoId}`;
  }

  async function add(files: File[]) {
    if (files.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    const notes: string[] = [];
    let room = GALLERY_MAX_PHOTOS - photos.length;
    for (const file of files) {
      if (room <= 0) {
        notes.push(`Stopped at ${GALLERY_MAX_PHOTOS} photos.`);
        break;
      }
      if (file.size === 0) {
        notes.push(`${file.name} is empty.`);
        continue;
      }
      if (file.size > GALLERY_MAX_BYTES) {
        notes.push(`${file.name} is over 12 MB.`);
        continue;
      }
      const body = new FormData();
      body.append("photo", file);
      try {
        const res = await fetch(`/api/gallery/${kind}/${encodeURIComponent(ownerId)}`, { method: "POST", body });
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          notes.push(payload?.error || `Could not add ${file.name}.`);
          if (payload?.error?.includes("20 photos")) break;
          continue;
        }
        room -= 1;
      } catch {
        notes.push(`Could not add ${file.name}.`);
      }
    }
    setError(notes.length > 0 ? notes.join(" ") : null);
    setBusy(false);
    router.refresh();
  }

  async function remove(photoId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url(photoId), { method: "DELETE" });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) setError(payload?.error || "Could not remove that photo.");
      else setPending(null);
    } catch {
      setError("Could not remove that photo.");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fg-muted">
          {photos.length} / {GALLERY_MAX_PHOTOS}
          {full ? " · This gallery is full." : ""}
        </p>
        <div>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="sr-only"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = "";
              void add(files);
            }}
          />
          <button
            type="button"
            disabled={full || busy}
            onClick={() => input.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" />
            {busy ? "Saving…" : "Add photos"}
          </button>
        </div>
      </div>
      {error ? <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">{error}</p> : null}
      {photos.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface/70 px-4 py-10 text-center text-sm text-fg-muted">
          No photos yet. JPEG, PNG, WebP, or GIF, up to 12 MB each. They stay on this computer.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo, index) => {
            const src = url(photo.id);
            return (
              <li key={photo.id} className="overflow-hidden rounded-xl border border-border bg-surface">
                <button
                  type="button"
                  onClick={() => setOpen(src)}
                  className="block w-full"
                  aria-label={`Open photo ${index + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="aspect-square w-full object-cover" />
                </button>
                <div className="flex justify-end px-2 py-1.5">
                  {pending === photo.id ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(photo.id)}
                      className="text-xs font-medium text-amber-600 hover:underline dark:text-amber-400"
                    >
                      Delete
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPending(photo.id)}
                      className="text-xs text-fg-subtle hover:text-fg"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(null)}
        >
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="absolute right-4 top-4 rounded-lg border border-white/20 p-2 text-white"
            aria-label="Close photo"
          >
            <X className="h-4 w-4" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={open} alt="" className="max-h-full max-w-full object-contain" onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}
    </div>
  );
}
