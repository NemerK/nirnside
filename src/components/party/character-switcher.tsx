"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Droplet, Moon, Search } from "lucide-react";
import { classColor } from "@/lib/classes";
import { GameIcon } from "../game-icon";
import type { PartyMember } from "./types";

function stat(m: PartyMember): string {
  return m.level >= 50 ? `CP ${m.championPoints.toLocaleString("en-US")}` : `Level ${m.level}`;
}

export function Crest({ m, size = 28 }: { m: PartyMember; size?: number }) {
  const color = classColor(m.className) ?? "#94889f";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-lg ${m.lastSeen == null ? "opacity-60" : ""}`}
      style={{
        width: size,
        height: size,
        background: `color-mix(in srgb, ${color} 18%, transparent)`,
        boxShadow: `inset 0 0 0 1px ${color}`,
      }}
    >
      <GameIcon name={m.className} icon={m.crest} size={Math.round(size * 0.72)} bare />
    </span>
  );
}

/**
 * The one control for "which character": a button showing the current one,
 * opening a searchable list of everyone. Works the same for 3 or 30
 * characters, and keeps the page free of a band of cards.
 */
export function CharacterSwitcher({
  members,
  current,
  hrefFor,
}: {
  members: PartyMember[];
  current: PartyMember | null;
  hrefFor: (m: PartyMember) => string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => `${m.name} ${m.className} ${m.race}`.toLowerCase().includes(q));
  }, [members, query]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onDown(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  function show() {
    setQuery("");
    setActive(Math.max(0, members.findIndex((m) => m.id === current?.id)));
    setOpen(true);
  }

  function go(m: PartyMember | undefined) {
    if (!m) return;
    setOpen(false);
    router.push(hrefFor(m));
  }

  function onKey(e: React.KeyboardEvent) {
    const cols = 3;
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "Enter") go(list[active]);
    else if (e.key === "ArrowDown") setActive((i) => Math.min(list.length - 1, i + cols));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(0, i - cols));
    else if (e.key === "ArrowRight" && !query) setActive((i) => Math.min(list.length - 1, i + 1));
    else if (e.key === "ArrowLeft" && !query) setActive((i) => Math.max(0, i - 1));
    else return;
    e.preventDefault();
  }

  if (members.length === 0) return null;
  const color = current ? classColor(current.className) ?? "var(--fg-muted)" : "var(--fg-muted)";

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Switch character ( [ and ] step through them )"
        className="flex h-10 items-center gap-2.5 rounded-xl border border-border bg-surface/80 pl-1.5 pr-2.5 text-left hover:border-border-strong"
      >
        {current ? <Crest m={current} /> : null}
        <span className="min-w-0">
          <span className="block max-w-[220px] truncate text-[14px] leading-tight text-fg">
            {current ? current.name : "Choose a character"}
          </span>
          {current ? (
            <span className="block text-[11px] leading-tight" style={{ color }}>
              {current.className} <span className="text-fg-subtle">· {stat(current)}</span>
            </span>
          ) : null}
        </span>
        <ChevronDown className="h-4 w-4 text-fg-subtle" aria-hidden />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose a character"
          onKeyDown={onKey}
          className="absolute left-0 top-12 z-50 w-[min(760px,calc(100vw-2.5rem))] rounded-2xl border border-border-strong bg-surface p-3 shadow-2xl shadow-black/50"
        >
          <label className="relative mb-2 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              placeholder={`Find one of ${members.length} characters by name, class or race`}
              aria-label="Find a character"
              className="w-full rounded-lg border border-border bg-bg py-2 pl-9 pr-3 text-[14px] text-fg placeholder:text-fg-subtle focus:border-border-strong focus:outline-none"
            />
          </label>
          {list.length === 0 ? (
            <p className="px-2 py-6 text-center text-[13px] text-fg-muted">No character matches “{query}”.</p>
          ) : (
            <ul className="grid max-h-[min(60vh,520px)] grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 md:grid-cols-3">
              {list.map((m, i) => {
                const here = m.id === current?.id;
                return (
                  <li key={m.id}>
                    <Link
                      href={hrefFor(m)}
                      onClick={() => setOpen(false)}
                      onMouseEnter={() => setActive(i)}
                      aria-current={here ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${
                        i === active ? "bg-surface-2" : ""
                      } ${here ? "ring-1 ring-inset ring-accent/50" : ""}`}
                    >
                      <Crest m={m} />
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-[13px] ${m.lastSeen == null ? "text-fg-muted" : "text-fg"}`}>
                          {m.name}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
                          <span style={{ color: classColor(m.className) ?? undefined }}>{m.className}</span>· {stat(m)}
                          {m.vampireStage > 0 ? <Droplet className="h-3 w-3 text-danger" aria-label="Vampire" /> : null}
                          {m.werewolf ? <Moon className="h-3 w-3 text-info" aria-label="Werewolf" /> : null}
                          {m.lastSeen == null ? <span>· not logged out yet</span> : null}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 px-1 text-[11px] text-fg-subtle">
            Arrow keys and Enter to pick. On character pages, <kbd className="rounded border border-border px-1">[</kbd>{" "}
            and <kbd className="rounded border border-border px-1">]</kbd> step to the previous or next character.
          </p>
        </div>
      ) : null}
    </div>
  );
}
