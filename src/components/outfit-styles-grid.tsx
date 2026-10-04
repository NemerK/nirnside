"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Card, PageScroll, StickyMenu } from "@/components/ui";
import { GameIcon } from "@/components/game-icon";
import type { PresentedOutfitStyles } from "@/lib/knowledge/present";

type UnlockFilter = "all" | "unlocked" | "locked";

export function OutfitStylesGrid({
  presented,
  motifKeys,
  initialQuery,
}: {
  presented: PresentedOutfitStyles;
  motifKeys: string[];
  initialQuery?: string;
}) {
  const knownMotifs = useMemo(() => new Set(motifKeys), [motifKeys]);
  const [categoryName, setCategoryName] = useState(presented.categories[0]?.name ?? "");
  const [query, setQuery] = useState(initialQuery ?? "");
  const [filter, setFilter] = useState<UnlockFilter>("all");

  const q = query.trim().toLowerCase();
  const category = presented.categories.find((c) => c.name === categoryName) ?? presented.categories[0];

  const visibleGroups = useMemo(() => {
    if (!category) return [];
    return category.groups
      .map((group) => {
        const styles = group.styles.filter((style) => {
          if (q && !style.name.toLowerCase().includes(q) && !group.name.toLowerCase().includes(q)) return false;
          if (filter === "unlocked") return style.unlocked;
          if (filter === "locked") return !style.unlocked;
          return true;
        });
        return { ...group, styles };
      })
      .filter((group) => group.styles.length > 0);
  }, [category, q, filter]);

  if (presented.categories.length === 0) {
    return <Card className="p-4 text-sm text-fg-muted">No Outfit Styles in the last scan.</Card>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StickyMenu>
        <div className="flex flex-wrap gap-1.5">
          {presented.categories.map((c) => {
            const active = c.name === category?.name;
            return (
              <button
                key={c.name}
                type="button"
                onClick={() => setCategoryName(c.name)}
                className={`rounded-lg border px-2.5 py-1 text-sm ${
                  active
                    ? "border-accent/50 bg-accent-soft text-accent"
                    : "border-border text-fg-muted hover:border-accent/30 hover:text-fg"
                }`}
              >
                {c.name}
                <span className="ml-1.5 text-[11px] text-fg-subtle">
                  {c.unlocked}/{c.total}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search styles…"
              className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "unlocked", "locked"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`rounded-md border px-2 py-1 text-xs capitalize ${
                  filter === key
                    ? "border-accent/50 bg-accent-soft text-accent"
                    : "border-border text-fg-subtle hover:text-fg"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      </StickyMenu>

      <PageScroll>
        <div className="space-y-5">
          {visibleGroups.map((group) => (
            <section key={group.name}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-fg">{group.name}</h3>
                <p className="text-xs text-fg-subtle">
                  {group.unlocked}/{group.total} unlocked
                  {knownMotifs.has(group.motifKey) ? (
                    <>
                      {" "}
                      ·{" "}
                      <Link href={`/knowledge?tab=motifs&q=${encodeURIComponent(group.name)}`} className="text-accent hover:underline">
                        Motif known
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {group.styles.map((style) => (
                  <li key={style.collectibleId}>
                    <Card className={`flex items-start gap-2 p-2 ${style.unlocked ? "" : "opacity-70"}`}>
                      <GameIcon name={style.name} icon={style.icon ?? undefined} size={40} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-fg">{style.name}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-fg-subtle">
                          {style.unlocked ? (
                            <>
                              <Check className="h-3 w-3 text-ok" /> Unlocked
                            </>
                          ) : (
                            "Locked"
                          )}
                        </p>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {visibleGroups.length === 0 && (
            <Card className="p-4 text-sm text-fg-muted">No styles in this category match the filter.</Card>
          )}
        </div>
      </PageScroll>
    </div>
  );
}
