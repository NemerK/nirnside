"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clearLoadingRetry } from "./loading-recovery";
import { NirnsideMark } from "./nirnside-mark";
import { NirnsideSettings } from "./nirnside-settings";
import type { ModuleDef } from "@/lib/modules";
import {
  Backpack,
  BookMarked,
  BookOpen,
  CalendarDays,
  Crosshair,
  FolderCog,
  Home,
  Landmark,
  LayoutDashboard,
  Library,
  ListChecks,
  Menu,
  Search,
  Shirt,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { timeAgo } from "@/lib/format";

export interface ShellAccount {
  displayName: string;
  region: string;
  esoPlus: boolean;
  lastSnapshot: number;
}

const NAV = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/focus", label: "Focus", icon: Crosshair },
  { href: "/planner", label: "Planner", icon: ListChecks },
  { href: "/characters", label: "Characters", icon: Users },
  { href: "/inventory", label: "Inventory", icon: Backpack },
  { href: "/stickerbook", label: "Stickerbook", icon: BookMarked },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/styles", label: "Styles", icon: Shirt },
  { href: "/dailies", label: "Dailies", icon: CalendarDays },
  { href: "/houses", label: "Houses", icon: Landmark },
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/encyclopedia", label: "Encyclopedia", icon: Library },
  { href: "/setup", label: "Setup", icon: FolderCog },
];

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <NirnsideMark className="h-8 w-8 shrink-0" />
      <span className="text-lg font-semibold tracking-wide text-fg">
        Nirn<span className="text-accent">side</span>
      </span>
    </Link>
  );
}

function NavLinks({ hiddenModules, onNavigate }: { hiddenModules?: string[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const hidden = new Set(hiddenModules ?? []);
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const moduleId = href === "/" ? "home" : href.slice(1);
        if (hidden.has(moduleId)) return null;
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <a
            key={href}
            href={href}
            onClick={onNavigate}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-accent-soft text-accent"
                : "text-fg-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            <Icon className={`h-4.5 w-4.5 ${active ? "text-accent" : "text-fg-subtle group-hover:text-fg"}`} />
            {label}
          </a>
        );
      })}
    </nav>
  );
}

function SearchBox({ onSubmit }: { onSubmit?: () => void }) {
  const [q, setQ] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) window.location.assign(`/search?q=${encodeURIComponent(q.trim())}`);
        onSubmit?.();
      }}
      className="relative w-full max-w-sm"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
            placeholder="Search characters, motifs, styles, sets…"
        className="w-full rounded-lg border border-border bg-surface py-1.5 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
      />
    </form>
  );
}

export function AppShell({
  account,
  hiddenModules,
  modules,
  children,
}: {
  account: ShellAccount | null;
  /** Module ids the player turned off in Setup. Hidden from the sidebar only. */
  hiddenModules?: string[];
  /** The toggleable module registry, for the settings modal. */
  modules?: ModuleDef[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    clearLoadingRetry();
  }, [pathname]);

  return (
    <div className="app-bg flex h-full flex-col overflow-hidden md:flex-row">
      {/* Sidebar (desktop) — stays put while the page list scrolls */}
      <aside className="hidden h-full w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-bg-elev/70 p-4 md:flex">
        <div className="mb-8 px-1">
          <Wordmark />
        </div>
        <NavLinks hiddenModules={hiddenModules} />
        <div className="mt-auto space-y-3 px-1 pt-4">
          <div className="flex items-center justify-between gap-2">
            <ThemeToggle />
            <NirnsideSettings modules={modules ?? []} hiddenModules={hiddenModules ?? []} compact />
          </div>
          <p className="text-xs leading-relaxed text-fg-subtle">
            Local &amp; private. Your data never leaves this machine.
          </p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-bg-elev/80 px-4 py-3 md:hidden">
        <Wordmark />
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          className="rounded-md border border-border p-2 text-fg-muted"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {open && (
        <div className="shrink-0 overflow-y-auto border-b border-border bg-bg-elev p-4 md:hidden">
          <div className="mb-3">
            <SearchBox onSubmit={() => setOpen(false)} />
          </div>
          <NavLinks hiddenModules={hiddenModules} onNavigate={() => setOpen(false)} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ThemeToggle />
            <NirnsideSettings modules={modules ?? []} hiddenModules={hiddenModules ?? []} />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="hidden shrink-0 items-center justify-between border-b border-border bg-bg-elev/40 px-8 py-3 md:flex">
          <div className="flex items-center gap-3 text-sm">
            {account ? (
              <>
                <span className="font-medium text-fg">{account.displayName}</span>
                <span className="rounded-md border border-border px-1.5 py-0.5 text-xs text-fg-muted">
                  {account.region}
                </span>
                {account.esoPlus && (
                  <span className="rounded-md border border-accent/40 bg-accent-soft px-1.5 py-0.5 text-xs text-accent">
                    ESO+
                  </span>
                )}
              </>
            ) : (
              <span className="text-fg-muted">No account imported yet</span>
            )}
          </div>
          <div className="mx-6 flex-1">
            <SearchBox />
          </div>
          {account && (
            <div className="flex items-center gap-2 text-xs text-fg-subtle">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: "var(--ok)" }}
                aria-hidden
              />
              Last snapshot {timeAgo(account.lastSnapshot)}
            </div>
          )}
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-6 md:px-8 md:py-8">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
