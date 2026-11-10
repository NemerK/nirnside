"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Backpack,
  BookOpen,
  CalendarDays,
  FolderCog,
  Home,
  Layers,
  Library,
  ListChecks,
  Menu,
  Search,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { ATLAS_NAV, atlasItemVisible } from "@/lib/ia";
import type { ModuleDef } from "@/lib/modules";
import { timeAgo } from "@/lib/format";
import { clearLoadingRetry } from "../loading-recovery";
import { NirnsideMark } from "../nirnside-mark";
import { NirnsideSettings } from "../nirnside-settings";
import { ThemeToggle } from "../theme-toggle";
import { LookToggle } from "../look-toggle";
import type { ShellAccount } from "../app-shell";

const ICONS: Record<string, LucideIcon> = {
  home: Home,
  inventory: Backpack,
  collections: Layers,
  achievements: Trophy,
  dailies: CalendarDays,
  characters: Users,
  knowledge: BookOpen,
  encyclopedia: Library,
  planner: ListChecks,
  setup: FolderCog,
};

function AtlasWordmark() {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <NirnsideMark className="h-9 w-9 shrink-0 transition-transform duration-500 group-hover:rotate-3" />
      <span className="atlas-display text-xl tracking-tight text-fg">
        Nirn<span className="text-accent">side</span>
        <span className="mt-0.5 block text-[10px] font-sans font-semibold uppercase tracking-[0.22em] text-fg-subtle">
          Atlas
        </span>
      </span>
    </Link>
  );
}

function AtlasNav({ hiddenModules, onNavigate }: { hiddenModules?: string[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const hidden = new Set(hiddenModules ?? []);

  return (
    <nav className="flex flex-col gap-6">
      {ATLAS_NAV.map((group) => {
        const items = group.items.filter((item) => atlasItemVisible(item, hidden));
        if (items.length === 0) return null;
        return (
          <div key={`${group.id}-${group.label}`}>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-fg-subtle">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {items.map((item) => {
                const Icon = ICONS[item.id] ?? Layers;
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    title={item.blurb}
                    onClick={onNavigate}
                    className={`group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                      active
                        ? "bg-accent-soft text-accent"
                        : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                    }`}
                  >
                    <Icon className={`h-4 w-4 ${active ? "text-accent" : "text-fg-subtle group-hover:text-fg"}`} />
                    <span className="font-medium">{item.label}</span>
                  </a>
                );
              })}
            </div>
          </div>
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
      className="relative w-full max-w-md"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search account and catalog…"
        className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
      />
    </form>
  );
}

export function AtlasShell({
  account,
  hiddenModules,
  modules,
  children,
}: {
  account: ShellAccount | null;
  hiddenModules?: string[];
  modules?: ModuleDef[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    clearLoadingRetry();
  }, [pathname]);

  return (
    <div className="atlas-shell app-bg flex h-full flex-col overflow-hidden md:flex-row">
      <aside className="atlas-rail hidden h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-bg-elev/80 p-4 md:flex">
        <div className="mb-8 px-1">
          <AtlasWordmark />
        </div>
        <AtlasNav hiddenModules={hiddenModules} />
        <div className="mt-auto space-y-3 px-1 pt-6">
          <LookToggle compact />
          <div className="flex items-center justify-between gap-2">
            <ThemeToggle />
            <NirnsideSettings modules={modules ?? []} hiddenModules={hiddenModules ?? []} compact />
          </div>
          <p className="text-[11px] leading-relaxed text-fg-subtle">
            Local &amp; private. Grouped by account, character, catalog, and plans.
          </p>
        </div>
      </aside>

      <div className="flex shrink-0 items-center justify-between border-b border-border bg-bg-elev/80 px-4 py-3 md:hidden">
        <AtlasWordmark />
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
          <AtlasNav hiddenModules={hiddenModules} onNavigate={() => setOpen(false)} />
          <div className="mt-4 space-y-3">
            <LookToggle />
            <div className="flex flex-wrap items-center gap-3">
              <ThemeToggle />
              <NirnsideSettings modules={modules ?? []} hiddenModules={hiddenModules ?? []} />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="atlas-topbar hidden shrink-0 items-center justify-between border-b border-border px-8 py-3.5 md:flex">
          <div className="flex min-w-0 items-center gap-3 text-sm">
            {account ? (
              <>
                <span className="atlas-display truncate text-lg text-fg">{account.displayName}</span>
                <span className="rounded border border-border px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-fg-muted">
                  {account.region}
                </span>
                {account.esoPlus && (
                  <span className="rounded border border-accent/40 bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">
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
              <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />
              Snapshot {timeAgo(account.lastSnapshot)}
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
