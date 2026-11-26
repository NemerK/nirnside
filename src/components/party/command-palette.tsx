"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import type { PartyLink, PartyMember } from "./types";

interface Hit {
  kind: string;
  name: string;
  detail?: string;
  href: string;
}

interface Results {
  catalog: Hit[];
  account: Hit[];
}

interface Section {
  title: string;
  hits: Hit[];
}

const EMPTY: Results = { catalog: [], account: [] };

/** Search answers with Atlas addresses; inside Party, open the Party page for the same thing. */
const PARTY_ROUTES: [RegExp, string][] = [
  [/^\/characters\/([^/?#]+)/, "/party/c/$1"],
  [/^\/inventory/, "/party/vault/inventory"],
  [/^\/stickerbook/, "/party/vault/sets"],
  [/^\/achievements/, "/party/vault/achievements"],
  [/^\/knowledge/, "/party/vault/crafting"],
  [/^\/styles/, "/party/vault/styles"],
  [/^\/houses/, "/party/vault/houses"],
];

export function toPartyHref(href: string): string {
  for (const [from, to] of PARTY_ROUTES) {
    if (from.test(href)) return href.replace(from, to);
  }
  return href;
}

function matches(text: string, q: string): boolean {
  return text.toLowerCase().includes(q.toLowerCase());
}

/**
 * ⌘K / Ctrl+K / "/" opens one search over pages, characters, the account and
 * the catalog. Pages and characters answer instantly from what the shell
 * already has; the rest comes from the local search route.
 */
export function CommandPalette({
  open,
  onClose,
  pages,
  characters,
}: {
  open: boolean;
  onClose: () => void;
  pages: PartyLink[];
  characters: PartyMember[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<Results>(EMPTY);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : EMPTY))
        .then((data: Results) => setRemote(data))
        .catch(() => {});
    }, 120);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const sections = useMemo<Section[]>(() => {
    const term = q.trim();
    const pageHits: Hit[] = pages
      .filter((p) => !term || matches(p.label, term) || matches(p.blurb, term))
      .map((p) => ({ kind: "Page", name: p.label, detail: p.blurb, href: p.href }));
    const charHits: Hit[] = characters
      .filter((c) => !term || matches(c.name, term) || matches(c.className, term))
      .map((c) => ({ kind: "Character", name: c.name, detail: `${c.race} ${c.className}`, href: `/party/c/${c.id}` }));
    const out: Section[] = [];
    if (!term) {
      out.push({ title: "Characters", hits: charHits });
      out.push({ title: "Go to", hits: pageHits });
      return out.filter((s) => s.hits.length > 0);
    }
    const live = term.length >= 2 ? remote : EMPTY;
    const charNames = new Set(charHits.map((h) => h.name.toLowerCase()));
    out.push({ title: "Characters", hits: charHits });
    out.push({ title: "Pages", hits: pageHits });
    out.push({
      title: "Your account",
      hits: live.account.filter((h) => !(h.kind === "Character" && charNames.has(h.name.toLowerCase()))),
    });
    out.push({ title: "Library", hits: live.catalog });
    return out.filter((s) => s.hits.length > 0);
  }, [q, remote, pages, characters]);

  const flat = useMemo(() => sections.flatMap((s) => s.hits), [sections]);

  const go = useCallback(
    (hit: Hit | undefined) => {
      if (!hit) return;
      onClose();
      setQ("");
      router.push(toPartyHref(hit.href));
    },
    [onClose, router],
  );

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  let index = -1;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[rgb(5_8_15/0.6)] px-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-label="Search"
        className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border-strong bg-surface shadow-[var(--shadow-pop)]"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-fg-subtle" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              else if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, flat.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(flat[active]);
              }
            }}
            placeholder="Search characters, items, sets, skills…"
            aria-label="Search"
            className="h-12 w-full bg-transparent text-[15px] text-fg placeholder:text-fg-subtle focus:outline-none"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[11px] text-fg-subtle">Esc</kbd>
        </div>
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
          {flat.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-fg-muted">
              {q.trim().length < 2 ? "Keep typing to search the account and the library." : `Nothing matches “${q.trim()}”.`}
            </p>
          ) : (
            sections.map((section) => (
              <div key={section.title} className="mb-2 last:mb-0">
                <p className="px-3 pb-1 pt-2 text-xs font-medium text-fg-subtle">{section.title}</p>
                {section.hits.map((hit) => {
                  index += 1;
                  const i = index;
                  const on = i === active;
                  return (
                    <button
                      key={`${section.title}-${hit.kind}-${hit.href}-${hit.name}`}
                      data-index={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(hit)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${
                        on ? "bg-surface-2" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-fg">{hit.name}</span>
                        {hit.detail ? <span className="block truncate text-xs text-fg-muted">{hit.detail}</span> : null}
                      </span>
                      <span className="shrink-0 text-xs text-fg-subtle">{hit.kind}</span>
                      {on ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-fg-subtle" /> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
