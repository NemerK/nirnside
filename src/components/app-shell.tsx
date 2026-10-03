"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clearLoadingRetry } from "./loading-recovery";
import {
  Backpack,
  BookMarked,
  CalendarDays,
  FolderCog,
  Home,
  Landmark,
  Library,
  Menu,
  ScrollText,
  Search,
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
  { href: "/characters", label: "Characters", icon: Users },
  { href: "/inventory", label: "Inventory", icon: Backpack },
  { href: "/stickerbook", label: "Stickerbook", icon: BookMarked },
  { href: "/dailies", label: "Dailies", icon: CalendarDays },
  { href: "/houses", label: "Houses", icon: Landmark },
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/encyclopedia", label: "Encyclopedia", icon: Library },
  { href: "/setup", label: "Setup", icon: FolderCog },
];

function Wordmark() {
  return (
    <a href="/" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-accent/40 bg-accent-soft text-accent">
        <ScrollText className="h-4.5 w-4.5" />
      </span>
      <span className="text-lg font-semibold tracking-wide text-fg">
        Nirn<span className="text-accent">side</span>
      </span>
    </a>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
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
            placeholder="Search characters, roles, sets, skills…"
        className="w-full rounded-lg border border-border bg-surface py-1.5 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
      />
    </form>
  );
}

export function AppShell({
  account,
  children,
}: {
  account: ShellAccount | null;
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
        <NavLinks />
        <div className="mt-auto space-y-3 px-1 pt-4">
          <ThemeToggle />
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
          <NavLinks onNavigate={() => setOpen(false)} />
          <div className="mt-4">
            <ThemeToggle />
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
