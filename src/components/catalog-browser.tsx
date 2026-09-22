"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { GameIcon } from "./game-icon";
import { SourceBadge } from "./source-badge";
import { PageScroll, StickyMenu } from "./ui";
import type { CatalogSource } from "@/lib/catalog/schema";

export interface BrowserItem {
  id: string;
  name: string;
  category: string;
  source: CatalogSource;
  href: string;
  subtitle?: string;
  icon?: string | null;
  owned?: boolean;
}

export function CatalogBrowser({
  items,
  searchPlaceholder = "Search…",
  initialSearch = "",
  ownedLabel = "Owned",
}: {
  items: BrowserItem[];
  searchPlaceholder?: string;
  initialSearch?: string;
  ownedLabel?: string;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort(),
    [items],
  );
  const hasOwnership = useMemo(() => items.some((i) => i.owned !== undefined), [items]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((i) => {
      if (q && !i.name.toLowerCase().includes(q)) return false;
      if (category && i.category !== category) return false;
      if (ownedOnly && !i.owned) return false;
      return true;
    });
  }, [items, search, category, ownedOnly]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StickyMenu className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
          />
        </div>
        {categories.length > 1 && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={`rounded-lg border bg-surface py-2 pl-2.5 pr-7 text-sm focus:border-accent focus:outline-none ${
              category ? "border-accent/50 text-fg" : "border-border text-fg-muted"
            }`}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        {hasOwnership && (
          <button
            onClick={() => setOwnedOnly((v) => !v)}
            className={`rounded-lg border px-2.5 py-2 text-sm transition-colors ${
              ownedOnly ? "border-accent/50 bg-accent-soft text-accent" : "border-border text-fg-muted hover:text-fg"
            }`}
          >
            {ownedLabel} only
          </button>
        )}
      </StickyMenu>

      <PageScroll>
      <div className="mb-3 text-sm text-fg-muted">{filtered.length} entries</div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((i) => (
          <Link
            key={i.id}
            href={i.href}
            className="group flex items-center gap-3 rounded-xl border border-border bg-surface/70 p-3 transition-colors hover:border-accent/50 hover:bg-surface-2"
          >
            <GameIcon name={i.name} icon={i.icon} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-fg group-hover:text-accent">{i.name}</span>
                {i.owned && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title="Owned/known" />}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-fg-muted">
                <span>{i.category}</span>
                {i.subtitle && <span className="truncate">· {i.subtitle}</span>}
              </div>
            </div>
            <div className="shrink-0">
              <SourceBadge source={i.source} />
            </div>
          </Link>
        ))}
      </div>
      </PageScroll>
    </div>
  );
}
