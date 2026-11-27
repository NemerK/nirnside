"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Pencil, Plus, X } from "lucide-react";
import {
  SHOWCASE_MODULES,
  STATUS_MAX,
  VISIBILITY_LABEL,
  canSee,
  type PartyProfile,
  type ShowcaseItem,
  type Viewer,
  type Visibility,
} from "@/lib/party/profile";
import { GameIcon } from "../game-icon";

export interface ProfileHeader {
  accountName: string;
  region: string;
  esoPlus: boolean;
  updated: string | null;
  bannerUrl: string | null;
  avatarUrl: string | null;
  color: string;
  main: {
    id: string;
    name: string;
    className: string;
    race: string;
    alliance: string;
    allianceColor: string | null;
    stat: string;
    icon: string | null;
    marks: string[];
  };
  characters: { id: string; name: string }[];
}

const DEF = new Map(SHOWCASE_MODULES.map((m) => [m.id, m]));

const VIEWERS: { id: Viewer; label: string }[] = [
  { id: "me", label: "You" },
  { id: "friend", label: "A friend" },
  { id: "public", label: "Everyone" },
];

async function save(profile: PartyProfile): Promise<boolean> {
  try {
    const res = await fetch("/api/party-profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(profile),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Your profile: banner, portrait, main character and status, then the
 * modules you chose to show. "View as" previews exactly what a friend or
 * anyone would see once sharing arrives with the web version.
 */
export function ProfileView({
  header,
  profile: initial,
  modules,
  hrefs,
}: {
  header: ProfileHeader;
  profile: PartyProfile;
  modules: Record<string, ReactNode>;
  hrefs: Record<string, string>;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState(initial);
  const [viewer, setViewer] = useState<Viewer>("me");
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(initial.status);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  async function update(next: PartyProfile, refresh = false) {
    setProfile(next);
    setError(null);
    if (!(await save(next))) setError("Could not save that change. Try again.");
    else if (refresh) router.refresh();
  }

  const setItem = (id: string, patch: Partial<ShowcaseItem>) =>
    update({ ...profile, showcase: profile.showcase.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const move = (id: string, by: number) => {
    const list = [...profile.showcase];
    const i = list.findIndex((s) => s.id === id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    update({ ...profile, showcase: list });
  };
  const remove = (id: string) => update({ ...profile, showcase: profile.showcase.filter((s) => s.id !== id) });
  const add = (id: string) => {
    const def = DEF.get(id);
    if (!def) return;
    update({ ...profile, showcase: [...profile.showcase, { id, visibility: def.visibility, size: def.size }] });
  };

  async function upload(kind: "avatar" | "banner", file: File | undefined) {
    if (!file) return;
    setUploading(kind);
    setError(null);
    const body = new FormData();
    body.set("photo", file);
    try {
      const res = await fetch(`/api/profile/${kind}`, { method: "POST", body });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Could not save that picture.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that picture.");
    } finally {
      setUploading(null);
    }
  }

  async function clearPicture(kind: "avatar" | "banner") {
    try {
      await fetch(`/api/profile/${kind}`, { method: "DELETE" });
      router.refresh();
    } catch {
      setError("Could not remove that picture.");
    }
  }

  const me = viewer === "me";
  const edit = editing && me;
  const shown = profile.showcase.filter((s) => DEF.has(s.id) && canSee(viewer, s.visibility));
  const hidden = SHOWCASE_MODULES.filter((m) => !profile.showcase.some((s) => s.id === m.id));
  const m = header.main;

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      {/* Who is looking, and customize. */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-fg-muted">
          <Eye className="h-4 w-4" aria-hidden />
          View as
          <div className="flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="View as">
            {VIEWERS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setViewer(v.id);
                  if (v.id !== "me") setEditing(false);
                }}
                aria-pressed={viewer === v.id}
                className={`rounded-md px-2.5 py-1 ${viewer === v.id ? "bg-surface-2 text-fg" : "hover:text-fg"}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        {me ? (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] ${
              editing ? "bg-accent text-accent-fg" : "border border-border text-fg hover:border-border-strong"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" /> {editing ? "Done" : "Customize"}
          </button>
        ) : null}
      </div>

      {!me ? (
        <p className="mb-3 rounded-lg border border-info/40 bg-info/10 px-3 py-2 text-[13px] text-fg-muted">
          This is what {viewer === "friend" ? "a friend" : "anyone with your link"} will see once sharing arrives with
          Nirnside on the web. Modules set to {viewer === "friend" ? "“Only me”" : "“Only me” or “Friends”"} are hidden.
        </p>
      ) : null}
      {error ? <p className="mb-3 rounded-lg border border-danger/40 px-3 py-2 text-[13px] text-danger">{error}</p> : null}

      {/* Header: banner, portrait, name, main character, status. */}
      <section className="party-module overflow-hidden p-0">
        <div className="relative h-44 sm:h-52" style={{ background: `linear-gradient(120deg, color-mix(in srgb, ${header.color} 55%, #1a1020), #120c18 70%)` }}>
          {header.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={header.bannerUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : null}
          {edit ? (
            <div className="absolute right-3 top-3 flex gap-2">
              <button
                type="button"
                onClick={() => bannerInput.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1.5 text-[12px] text-white backdrop-blur hover:bg-black/75"
              >
                <ImagePlus className="h-3.5 w-3.5" /> {uploading === "banner" ? "Uploading…" : "Change banner"}
              </button>
              {header.bannerUrl ? (
                <button
                  type="button"
                  onClick={() => clearPicture("banner")}
                  className="rounded-lg bg-black/60 px-2.5 py-1.5 text-[12px] text-white backdrop-blur hover:bg-black/75"
                >
                  Remove
                </button>
              ) : null}
              <input ref={bannerInput} type="file" accept="image/*" hidden onChange={(e) => upload("banner", e.target.files?.[0])} />
            </div>
          ) : null}
        </div>
        <div className="relative px-5 pb-5 sm:px-7">
          <div className="-mt-14 flex flex-wrap items-start gap-x-5 gap-y-3">
            <div className="relative">
              <div
                className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-surface"
                style={{ boxShadow: `0 0 0 4px var(--surface), 0 0 0 6px ${header.color}` }}
              >
                {header.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={header.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <GameIcon name={m.className} icon={m.icon ?? undefined} size={64} bare />
                )}
              </div>
              {edit ? (
                <>
                  <button
                    type="button"
                    onClick={() => avatarInput.current?.click()}
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-white hover:bg-black/85"
                  >
                    {uploading === "avatar" ? "Uploading…" : "Change"}
                  </button>
                  <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => upload("avatar", e.target.files?.[0])} />
                </>
              ) : null}
            </div>
            <div className="min-w-0 flex-1 pt-[4.25rem]">
              <h1 className="font-display text-[34px] leading-tight text-fg">{header.accountName}</h1>
              <p className="text-[13px] text-fg-muted">
                {header.region}
                {header.esoPlus ? " · ESO Plus" : ""}
                {header.updated ? <span className="text-fg-subtle"> · updated {header.updated}</span> : null}
                {edit && header.avatarUrl ? (
                  <button type="button" onClick={() => clearPicture("avatar")} className="ml-3 text-[12px] text-fg-subtle hover:text-danger">
                    Remove portrait
                  </button>
                ) : null}
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="mt-4">
            {edit ? (
              <label className="block">
                <span className="sr-only">Status</span>
                <input
                  value={status}
                  maxLength={STATUS_MAX}
                  onChange={(e) => setStatus(e.target.value)}
                  onBlur={() => status !== profile.status && update({ ...profile, status })}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  placeholder="Set a status, like “Farming Slimecraw” or “LF vet trials”"
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-[15px] text-fg placeholder:text-fg-subtle focus:border-border-strong focus:outline-none"
                />
              </label>
            ) : profile.status ? (
              <p className="flex items-center gap-2.5 text-[15px] text-fg">
                <span className="h-2 w-2 rounded-full" style={{ background: header.color }} aria-hidden />
                {profile.status}
              </p>
            ) : me ? (
              <button type="button" onClick={() => setEditing(true)} className="text-[14px] text-fg-subtle hover:text-fg">
                Set a status
              </button>
            ) : null}
          </div>

          {/* Main character */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-fg-subtle">Main</span>
            {edit ? (
              <select
                value={m.id}
                onChange={(e) => update({ ...profile, mainCharacterId: e.target.value }, true)}
                aria-label="Main character"
                className="rounded-md border border-border bg-surface px-2 py-1 text-[13px] text-fg"
              >
                {header.characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <Link href={`/party/c/${encodeURIComponent(m.id)}`} className="text-[14px] text-fg hover:text-accent">
                {m.name}
              </Link>
            )}
            {[
              { label: m.className, color: header.color },
              { label: m.race, color: "var(--fg-subtle)" },
              { label: m.alliance, color: m.allianceColor ?? "var(--fg-subtle)" },
              { label: m.stat, color: "var(--accent)" },
              ...m.marks.map((x) => ({ label: x, color: "var(--fg-subtle)" })),
            ].map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg/60 px-2.5 py-0.5 text-[12px] text-fg"
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: chip.color }} aria-hidden />
                {chip.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Showcase */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {shown.map((s, i) => {
          const def = DEF.get(s.id)!;
          const href = hrefs[s.id];
          return (
            <section key={s.id} className={`party-module flex min-w-0 flex-col px-4 pb-4 pt-3 ${s.size === "full" ? "md:col-span-2" : ""}`}>
              <header className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-[18px] leading-tight text-fg">
                  {href && !edit ? (
                    <Link href={href} className="hover:text-accent">
                      {def.label}
                    </Link>
                  ) : (
                    def.label
                  )}
                </h2>
                {edit ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                    <select
                      value={s.visibility}
                      onChange={(e) => setItem(s.id, { visibility: e.target.value as Visibility })}
                      aria-label={`Who can see ${def.label}`}
                      className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-fg"
                    >
                      {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((v) => (
                        <option key={v} value={v}>
                          {VISIBILITY_LABEL[v]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setItem(s.id, { size: s.size === "full" ? "half" : "full" })}
                      className="rounded-md border border-border px-1.5 py-0.5 text-fg-muted hover:text-fg"
                      title="Make this module wide or narrow"
                    >
                      {s.size === "full" ? "Narrow" : "Wide"}
                    </button>
                    <button type="button" onClick={() => move(s.id, -1)} disabled={i === 0} aria-label="Move up" className="rounded-md p-1 text-fg-muted hover:text-fg disabled:opacity-30">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(s.id, 1)}
                      disabled={i === shown.length - 1}
                      aria-label="Move down"
                      className="rounded-md p-1 text-fg-muted hover:text-fg disabled:opacity-30"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => remove(s.id)} aria-label={`Hide ${def.label}`} className="rounded-md p-1 text-fg-muted hover:text-danger">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : me ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-fg-subtle" title="Who can see this module">
                    {s.visibility === "private" ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {VISIBILITY_LABEL[s.visibility]}
                  </span>
                ) : null}
              </header>
              <div className="min-w-0 flex-1">{modules[s.id]}</div>
            </section>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="party-module mt-4 px-6 py-8 text-center text-[14px] text-fg-muted">
          {me ? "No modules on your profile. Press Customize to add some." : "Nothing shared with this viewer yet."}
        </p>
      ) : null}

      {edit && hidden.length > 0 ? (
        <section className="mt-4 rounded-2xl border border-dashed border-border px-4 py-3">
          <h2 className="mb-2 text-[13px] text-fg-muted">Add to your profile</h2>
          <ul className="flex flex-wrap gap-2">
            {hidden.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => add(h.id)}
                  title={h.blurb}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-[13px] text-fg hover:border-border-strong"
                >
                  <Plus className="h-3.5 w-3.5" /> {h.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
