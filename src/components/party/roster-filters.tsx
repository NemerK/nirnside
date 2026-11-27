"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { anyFilter, type FilterChoices } from "@/lib/roles/filter";
import type { CharacterFilters } from "@/lib/roles/types";

type Key = "q" | "class" | "race" | "alliance" | "role";

/**
 * Who the roster shows, in every view. The filters live in the URL, so they
 * carry over when switching between Cards, At a glance and Skill lines.
 * A filter appears only when the roster has more than one value for it.
 */
export function RosterFilters({
  choices,
  current,
  shown,
  total,
}: {
  choices: FilterChoices;
  current: CharacterFilters;
  shown: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const [text, setText] = useState(current.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Follow the URL when it changes from elsewhere (Clear), but not while typing.
  const [seen, setSeen] = useState(current.q ?? "");
  if ((current.q ?? "") !== seen) {
    setSeen(current.q ?? "");
    if ((current.q ?? "") !== text.trim()) setText(current.q ?? "");
  }

  function set(changes: Partial<Record<Key, string>>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const qs = sp.toString();
    start(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function type(next: string) {
    setText(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => set({ q: next.trim() }), 250);
  }

  const filtered = anyFilter(current);

  const pick = (key: Key, label: string, value: string | undefined, options: { value: string; label: string }[]) =>
    options.length > 1 || value ? (
      <select
        value={value ?? ""}
        onChange={(e) => set({ [key]: e.target.value })}
        aria-label={label}
        className={`rounded-md border bg-surface px-2.5 py-1.5 text-sm ${
          value ? "border-accent/60 text-fg" : "border-border text-fg-muted"
        }`}
      >
        <option value="">{label}: all</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    ) : null;

  const plain = (list: string[]) => list.map((v) => ({ value: v, label: v }));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-2" role="search" aria-label="Filter characters">
      <label className="relative w-full sm:w-56">
        {pending ? (
          <Loader2 className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-fg-subtle" />
        ) : (
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
        )}
        <input
          value={text}
          onChange={(e) => type(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") type("");
          }}
          placeholder="Find a character"
          aria-label="Find a character"
          className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-7 text-sm text-fg placeholder:text-fg-subtle focus:border-border-strong focus:outline-none"
        />
        {text ? (
          <button
            type="button"
            onClick={() => type("")}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-fg-subtle hover:text-fg"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </label>
      {pick("class", "Class", current.className, plain(choices.classes))}
      {pick("race", "Race", current.race, plain(choices.races))}
      {pick("alliance", "Alliance", current.alliance, plain(choices.alliances))}
      {pick(
        "role",
        "Role",
        current.role,
        choices.roles.map((r) => ({ value: r.id, label: r.name })),
      )}
      {filtered ? (
        <>
          <span className="text-[13px] tabular-nums text-fg-subtle">
            {shown} of {total}
          </span>
          <button
            type="button"
            onClick={() => {
              setText("");
              set({ q: "", class: "", race: "", alliance: "", role: "" });
            }}
            className="text-[13px] text-accent hover:underline"
          >
            Clear filters
          </button>
        </>
      ) : null}
    </div>
  );
}
