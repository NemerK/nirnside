"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Backpack,
  BookMarked,
  FolderCog,
  Home,
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
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/encyclopedia", label: "Encyclopedia", icon: Library },
  { href: "/setup", label: "Setup", icon: FolderCog },
];

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-accent/40 bg-accent-soft text-accent">
        <ScrollText className="h-4.5 w-4.5" />
      </span>
      <span className="text-lg font-semibold tracking-wide text-fg">
        Nirn<span className="text-accent">side</span>
      </span>
    </Link>
  );
}

function NavLinks({
  onNavigate,
  horizontal,
}: {
  onNavigate?: () => void;
  horizontal?: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav className={horizontal ? "flex flex-wrap items-center gap-1" : "flex flex-col gap-1"}>
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`group flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-accent text-accent-fg"
                : "text-fg-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            <Icon className={`h-4 w-4 ${active ? "text-accent-fg" : "text-fg-subtle group-hover:text-fg"}`} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function SearchBox({ onSubmit }: { onSubmit?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        onSubmit?.();
      }}
      className="relative w-full max-w-sm"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search sets, skills, CP, your bags…"
        className="w-full rounded-full border border-border bg-surface py-1.5 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
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

  return (
    <div className="app-bg flex min-h-full flex-col">
      <div className="bg-accent px-4 py-2 text-center text-sm font-semibold text-accent-fg">
        Live-update test layout — teal + top bar. If you see this, the .exe pulled GitHub main.
      </div>

      <header className="border-b border-border bg-bg-elev/90 px-4 py-3 md:px-6">
        <div className="flex items-center gap-4">
          <Wordmark />
          <div className="hidden flex-1 md:block">
            <NavLinks horizontal />
          </div>
          <div className="ml-auto hidden md:block">
            <SearchBox />
          </div>
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            className="ml-auto rounded-md border border-border p-2 text-fg-muted md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="mt-3 border-t border-border pt-3 md:hidden">
            <div className="mb-3">
              <SearchBox onSubmit={() => setOpen(false)} />
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="mt-4">
              <ThemeToggle />
            </div>
          </div>
        )}
        <div className="mt-2 hidden items-center gap-3 text-xs md:flex">
          {account ? (
            <>
              <span className="font-medium text-fg">{account.displayName}</span>
              <span className="rounded-full border border-border px-1.5 py-0.5 text-fg-muted">{account.region}</span>
              {account.esoPlus && (
                <span className="rounded-full border border-accent/40 bg-accent-soft px-1.5 py-0.5 text-accent">ESO+</span>
              )}
              <span className="ml-auto flex items-center gap-2 text-fg-subtle">
                <span className="h-2 w-2 rounded-full" style={{ background: "var(--ok)" }} aria-hidden />
                Last snapshot {timeAgo(account.lastSnapshot)}
              </span>
            </>
          ) : (
            <span className="text-fg-muted">No account imported yet</span>
          )}
        </div>
      </header>

      <main className="flex-1 px-5 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
