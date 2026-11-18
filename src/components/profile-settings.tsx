"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileKind, ProfileMedia } from "@/lib/profile/media";

const EMPTY: ProfileMedia = { avatar: null, banner: null };

export function ProfileSettings() {
  const router = useRouter();
  const [media, setMedia] = useState<ProfileMedia>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ProfileKind | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let gone = false;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body: ProfileMedia) => {
        if (!gone) setMedia({ avatar: body.avatar ?? null, banner: body.banner ?? null });
      })
      .catch(() => {
        if (!gone) setError("Could not load your pictures.");
      });
    return () => {
      gone = true;
    };
  }, []);

  async function upload(kind: ProfileKind, file: File | undefined) {
    if (!file) return;
    setBusy(kind);
    setError(null);
    const body = new FormData();
    body.set("photo", file);
    try {
      const res = await fetch(`/api/profile/${kind}`, { method: "POST", body });
      const payload = (await res.json()) as { updatedAt?: number; error?: string };
      if (!res.ok || payload.updatedAt == null) throw new Error(payload.error || "Could not save that picture.");
      setMedia((current) => ({ ...current, [kind]: payload.updatedAt }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that picture.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(kind: ProfileKind) {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch(`/api/profile/${kind}`, { method: "DELETE" });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not remove that picture.");
      setMedia((current) => ({ ...current, [kind]: null }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that picture.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-4 rounded-lg border border-border bg-surface-2/40 p-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Profile</p>
      <p className="mb-3 text-xs text-fg-subtle">
        A picture and a banner for Home. They stay on this machine. Home uses them once you add them, and the class crest until then.
      </p>
      <div className="space-y-3">
        <div className="overflow-hidden rounded-lg border border-border bg-bg">
          <div className="relative h-20 bg-surface-2">
            {media.banner != null ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/profile/banner?v=${media.banner}`} alt="Banner" className="h-full w-full object-cover" />
            ) : (
              <span className="absolute inset-0 grid place-items-center text-xs text-fg-subtle">No banner yet</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 px-3 py-2">
            <PictureButton label={media.banner != null ? "Change banner" : "Add banner"} busy={busy === "banner"} onClick={() => bannerInput.current?.click()} />
            {media.banner != null ? (
              <PictureButton label="Remove banner" busy={busy === "banner"} onClick={() => remove("banner")} quiet />
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-bg px-3 py-2">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-surface-2">
            {media.avatar != null ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/profile/avatar?v=${media.avatar}`} alt="Profile picture" className="h-full w-full object-cover" />
            ) : (
              <span className="grid h-full place-items-center text-[10px] text-fg-subtle">Picture</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <PictureButton label={media.avatar != null ? "Change picture" : "Add picture"} busy={busy === "avatar"} onClick={() => avatarInput.current?.click()} />
            {media.avatar != null ? (
              <PictureButton label="Remove picture" busy={busy === "avatar"} onClick={() => remove("avatar")} quiet />
            ) : null}
          </div>
        </div>
      </div>
      <input
        ref={avatarInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        aria-label="Choose a profile picture"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void upload("avatar", file);
        }}
      />
      <input
        ref={bannerInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        aria-label="Choose a banner"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void upload("banner", file);
        }}
      />
      {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
    </section>
  );
}

function PictureButton({
  label,
  busy,
  onClick,
  quiet,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
  quiet?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`rounded-md border px-2 py-1 text-xs disabled:opacity-60 ${
        quiet ? "border-transparent text-fg-subtle hover:text-fg" : "border-border bg-surface text-fg hover:border-accent/50"
      }`}
    >
      {label}
    </button>
  );
}
