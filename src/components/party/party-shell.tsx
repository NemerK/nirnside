"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Backpack,
  BookOpen,
  CalendarCheck,
  House,
  Layers,
  Library,
  ListChecks,
  Search,
  Settings,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import { timeAgo } from "@/lib/format";
import { toPartyHref } from "@/lib/party/links";
import { PARTY_NAV, navItemActive, navItemVisible, type PartyIcon } from "./areas";
import { CommandPalette } from "./command-palette";
import type { PartyAccount, PartyLink, PartyMember } from "./types";

const ICONS: Record<PartyIcon, LucideIcon> = {
  home: House,
  bag: Backpack,
  layers: Layers,
  trophy: Trophy,
  calendar: CalendarCheck,
  users: Users,
  book: BookOpen,
  library: Library,
  list: ListChecks,
  swords: Swords,
  settings: Settings,
};

const MembersContext = createContext<PartyMember[]>([]);

/** The roster, for character pages' switcher. Read once by the Party layout. */
export function usePartyMembers(): PartyMember[] {
  return useContext(MembersContext);
}

export function PartyShell({
  account,
  members,
  disabled,
  children,
}: {
  account: PartyAccount | null;
  members: PartyMember[];
  /** Modules switched off in Setup. */
  disabled: string[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [palette, setPalette] = useState(false);
  const off = useMemo(() => new Set(disabled), [disabled]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPalette((v) => !v);
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      if (!typing && e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setPalette(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Shared components still link to Atlas addresses; open the Party page for
  // the same thing instead, so a click never switches looks.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.dataset.look || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
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

  const pages = useMemo<PartyLink[]>(
    () =>
      PARTY_NAV.flatMap((g) =>
        g.items.filter((i) => navItemVisible(i, off)).map((i) => ({ id: i.id, label: i.label, href: i.href, blurb: g.label })),
      ),
    [off],
  );

  return (
    <div className="party-sky flex min-h-full">
      <aside className="sticky top-0 flex h-dvh w-16 shrink-0 flex-col border-r border-border/70 bg-bg/80 backdrop-blur-md lg:w-56">
        <Link href="/party" className="flex h-14 items-center gap-2 px-4 lg:px-5" title="Your profile">
          <span className="font-display text-[19px] tracking-[0.08em] text-fg">
            <span className="lg:hidden">N</span>
            <span className="hidden lg:inline">NIRNSIDE</span>
          </span>
        </Link>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 pb-4 lg:px-3">
          {PARTY_NAV.map((g) => {
            const items = g.items.filter((i) => navItemVisible(i, off));
            if (items.length === 0) return null;
            return (
              <div key={g.label} className="mt-3 first:mt-1">
                <p className="hidden px-2 pb-1 text-[11px] text-fg-subtle lg:block">{g.label}</p>
                <ul className="space-y-0.5">
                  {items.map((i) => {
                    const Icon = ICONS[i.icon];
                    const on = navItemActive(i, pathname);
                    return (
                      <li key={i.id}>
                        <Link
                          href={i.href}
                          aria-current={on ? "page" : undefined}
                          title={i.label}
                          className={`flex items-center justify-center gap-2.5 rounded-lg px-2 py-1.5 text-[14px] transition-colors lg:justify-start ${
                            on ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-surface hover:text-fg"
                          }`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${on ? "text-accent" : ""}`} aria-hidden />
                          <span className="hidden truncate lg:inline">{i.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        <div className="space-y-2 border-t border-border/70 p-2 lg:p-3">
          <button
            type="button"
            onClick={() => setPalette(true)}
            title="Search (Ctrl K)"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface/70 px-2.5 py-1.5 text-[13px] text-fg-subtle hover:border-border-strong hover:text-fg-muted lg:justify-start"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Search</span>
            <kbd className="ml-auto hidden rounded border border-border px-1 text-[11px] lg:inline">Ctrl K</kbd>
          </button>
          {account ? (
            <p className="hidden px-1 text-[12px] leading-snug text-fg-subtle lg:block">
              {account.displayName}
              <br />
              updated {timeAgo(account.lastSnapshot)}
            </p>
          ) : null}
          <Link
            href="/"
            data-look="atlas"
            className="hidden px-1 text-[12px] text-fg-subtle hover:text-fg lg:block"
            title="Switch back to the Atlas look"
          >
            Atlas look
          </Link>
        </div>
      </aside>

      <MembersContext.Provider value={members}>
        <main className="min-w-0 flex-1 px-4 pb-12 pt-5 md:px-8">{children}</main>
      </MembersContext.Provider>

      <CommandPalette open={palette} onClose={() => setPalette(false)} pages={pages} characters={members} />
    </div>
  );
}
