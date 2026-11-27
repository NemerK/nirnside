"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { classColor } from "@/lib/classes";
import { timeAgo } from "@/lib/format";
import { CHARACTER_SECTIONS } from "@/lib/party/sections";
import { toPartyHref } from "@/lib/party/links";
import { ACCOUNT_SECTIONS, ACROSS_SECTIONS } from "./areas";
import { CharacterSwitcher } from "./character-switcher";
import { CommandPalette } from "./command-palette";
import type { PartyAccount, PartyLink, PartyMember } from "./types";

const LAST_KEY = "nirnside-party-character";

/** Party's four areas. Each one is about one scope, so it's always clear whose data you're reading. */
const AREAS = [
  { id: "account", label: "Account", href: "/party/account", match: ["/party/account"] },
  { id: "characters", label: "Characters", href: "/party/characters", match: ["/party/characters", "/party/c/"] },
  { id: "across", label: "Across characters", href: "/party/across/skills", match: ["/party/across"] },
  { id: "library", label: "Library", href: "/party/library", match: ["/party/library"] },
] as const;

function inArea(pathname: string, match: readonly string[]): boolean {
  return match.some((m) => (m.endsWith("/") ? pathname.startsWith(m) : pathname === m || pathname.startsWith(`${m}/`)));
}

export const PARTY_LINKS: PartyLink[] = [
  { id: "account", label: "Account", href: "/party/account", blurb: "What the whole account shares, and every character at a glance." },
  { id: "characters", label: "Characters", href: "/party/characters", blurb: "Pick a character to open their own pages." },
  ...ACROSS_SECTIONS.map((s) => ({
    id: `across-${s.id}`,
    label: `Across characters: ${s.label}`,
    href: `/party/across/${s.id}`,
    blurb: "Everyone at once.",
  })),
];

/** The character a Party address is about, and the section after it (/skills, /gear…). */
function parseCharacterPath(pathname: string): { id: string | null; rest: string } {
  const m = pathname.match(/^\/party\/c\/([^/]+)(\/.*)?$/);
  return m ? { id: decodeURIComponent(m[1]), rest: m[2] ?? "" } : { id: null, rest: "" };
}

const LIBRARY_SECTIONS = [
  { id: "", label: "Overview" },
  { id: "sets", label: "Sets" },
  { id: "skills", label: "Skills" },
  { id: "champion-points", label: "Champion Points" },
  { id: "scribing", label: "Scribing" },
] as const;

type Tab = { href: string; label: string; on: boolean };

/** The second header row: the sections of whichever area you're in. */
function areaTabs(pathname: string, characterBase: string, characterRest: string, isCharacter: boolean): Tab[] {
  const seg = (base: string) => pathname.slice(base.length).replace(/^\//, "").split("/")[0] ?? "";
  if (isCharacter) {
    const here = characterRest.replace(/^\//, "").split("/")[0] ?? "";
    return CHARACTER_SECTIONS.map((s) => ({
      href: s.id ? `${characterBase}/${s.id}` : characterBase,
      label: s.label,
      on: here === s.id,
    }));
  }
  if (pathname === "/party/account" || pathname.startsWith("/party/account/")) {
    const here = seg("/party/account");
    return ACCOUNT_SECTIONS.map((s) => ({
      href: s.id ? `/party/account/${s.id}` : "/party/account",
      label: s.label,
      on: here === s.id,
    }));
  }
  if (pathname.startsWith("/party/across/")) {
    const here = seg("/party/across");
    return ACROSS_SECTIONS.map((s) => ({ href: `/party/across/${s.id}`, label: s.label, on: here === s.id }));
  }
  if (pathname === "/party/library" || pathname.startsWith("/party/library/")) {
    const here = seg("/party/library");
    return LIBRARY_SECTIONS.map((s) => ({
      href: s.id ? `/party/library/${s.id}` : "/party/library",
      label: s.label,
      on: here === s.id,
    }));
  }
  return [];
}

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

export function PartyShell({
  account,
  members,
  children,
}: {
  account: PartyAccount | null;
  members: PartyMember[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { id: currentId, rest } = parseCharacterPath(pathname);
  const [lastId, setLastId] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    if (currentId) {
      try {
        localStorage.setItem(LAST_KEY, currentId);
      } catch {
        /* storage can be off; switching still works */
      }
      return;
    }
    try {
      // Restoring a remembered choice after hydration; nothing to sync from.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLastId(localStorage.getItem(LAST_KEY));
    } catch {
      setLastId(null);
    }
  }, [currentId]);

  const selectedId = currentId ?? (members.some((m) => m.id === lastId) ? lastId : null) ?? members[0]?.id ?? null;
  const index = members.findIndex((m) => m.id === selectedId);
  const current = index >= 0 ? members[index] : null;
  // On a character page, switching keeps you on the same section.
  const hrefFor = (m: PartyMember) => `/party/c/${encodeURIComponent(m.id)}${currentId ? rest : ""}`;
  const step = (by: number) => {
    if (members.length === 0) return;
    const next = members[(Math.max(index, 0) + by + members.length) % members.length];
    router.push(hrefFor(next));
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        setPalette(true);
      } else if (currentId && (e.key === "[" || e.key === "]")) {
        e.preventDefault();
        step(e.key === "]" ? 1 : -1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Shared components still link to Atlas addresses; open the Party page for
  // the same thing instead, so a click never switches looks.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const path = `${url.pathname}${url.search}${url.hash}`;
      const mapped = toPartyHref(path);
      if (mapped === path) return;
      e.preventDefault();
      e.stopPropagation();
      router.push(mapped);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  const hero = classColor(current?.className ?? "") ?? "#b46ad4";
  const pages = useMemo<PartyLink[]>(
    () => [
      ...PARTY_LINKS,
      ...ACCOUNT_SECTIONS.filter((v) => v.id).map((v) => ({
        id: `account-${v.id}`,
        label: `Account: ${v.label}`,
        href: `/party/account/${v.id}`,
        blurb: "Shared by every character.",
      })),
      { id: "library", label: "Library", href: "/party/library", blurb: "Sets, skills, Champion Points and scribing." },
      ...LIBRARY_SECTIONS.filter((v) => v.id).map((v) => ({
        id: `library-${v.id}`,
        label: `Library: ${v.label}`,
        href: `/party/library/${v.id}`,
        blurb: "The game's reference, with what you own.",
      })),
      { id: "setup", label: "Setup", href: "/party/setup", blurb: "Find ESO, install the addons." },
    ],
    [],
  );

  const navLink = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg px-3 py-1.5 text-[14px] transition-colors ${
        active ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"
      }`}
    >
      {label}
    </Link>
  );

  const characterBase = current ? `/party/c/${encodeURIComponent(current.id)}` : "/party";
  const tabs = areaTabs(pathname, characterBase, rest, !!currentId && !!current);

  return (
    <div className="party-sky flex min-h-full flex-col" style={{ "--hero": hero } as CSSProperties}>
      <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/85 backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-4 md:px-6">
          <Link href="/party/account" className="mr-1 hidden font-display text-[19px] tracking-[0.08em] text-fg sm:block">
            NIRNSIDE
          </Link>
          {currentId && current ? (
            <>
              {members.length > 1 ? (
                <button
                  type="button"
                  onClick={() => step(-1)}
                  aria-label="Previous character"
                  title="Previous character  [ "
                  className="hidden h-8 w-6 items-center justify-center rounded-md text-fg-subtle hover:text-fg md:flex"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              ) : null}
              <CharacterSwitcher members={members} current={current} hrefFor={hrefFor} />
              {members.length > 1 ? (
                <button
                  type="button"
                  onClick={() => step(1)}
                  aria-label="Next character"
                  title="Next character  ] "
                  className="hidden h-8 w-6 items-center justify-center rounded-md text-fg-subtle hover:text-fg md:flex"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : null}
            </>
          ) : null}
          <nav aria-label="Main" className="ml-2 flex items-center gap-0.5 overflow-x-auto">
            {AREAS.map((a) => navLink(a.href, a.label, inArea(pathname, a.match)))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPalette(true)}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface/70 px-2.5 py-1.5 text-[13px] text-fg-subtle hover:border-border-strong hover:text-fg-muted"
            >
              <Search className="h-3.5 w-3.5" /> <span className="hidden lg:inline">Search</span>
              <kbd className="hidden rounded border border-border px-1 text-[11px] lg:inline">Ctrl K</kbd>
            </button>
            {account ? (
              <span
                className="hidden text-[12px] leading-tight text-fg-subtle xl:block"
                title={`${account.displayName} · ${account.region}${account.esoPlus ? " · ESO+" : ""}`}
              >
                {account.displayName}
                <span className="block">updated {timeAgo(account.lastSnapshot)}</span>
              </span>
            ) : null}
            <Link href="/" className="whitespace-nowrap text-[12px] text-fg-subtle hover:text-fg" title="Switch back to the Atlas look">
              Atlas look
            </Link>
          </div>
        </div>
        {tabs.length > 0 ? (
          <nav aria-label="Sections" className="flex h-10 items-end gap-1 overflow-x-auto px-4 md:px-6">
            {tabs.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                aria-current={t.on ? "page" : undefined}
                className={`whitespace-nowrap border-b-2 px-3 pb-2 text-[13px] transition-colors ${
                  t.on ? "border-[color:var(--hero)] text-fg" : "border-transparent text-fg-muted hover:text-fg"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="flex-1 px-4 pb-12 pt-5 md:px-6">{children}</main>

      <CommandPalette open={palette} onClose={() => setPalette(false)} pages={pages} characters={members} />
    </div>
  );
}
