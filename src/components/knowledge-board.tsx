"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Minus, Search } from "lucide-react";
import { Card, PageScroll, StickyMenu } from "@/components/ui";
import {
  formatResearchRemaining,
  motifKey,
  recipeQualityClass,
  type PresentedResearch,
} from "@/lib/knowledge/present";
import type { MotifStyle, RecipeList } from "@/lib/snapshot/schema";

export type KnowledgeTab = "research" | "motifs" | "recipes" | "plans";

export interface KnowledgeCharacterView {
  id: string;
  name: string;
  className: string;
  scanned: boolean;
  research: PresentedResearch;
  motifs: MotifStyle[];
  recipes: RecipeList[];
  plans: RecipeList[];
  scribingCount: number;
}

const TABS: { key: KnowledgeTab; label: string }[] = [
  { key: "research", label: "Research" },
  { key: "motifs", label: "Motifs" },
  { key: "recipes", label: "Recipes" },
  { key: "plans", label: "Plans" },
];

type KnownFilter = "all" | "known" | "missing";

export function KnowledgeBoard({
  characters,
  initialCharId,
  initialTab,
  initialQuery,
}: {
  characters: KnowledgeCharacterView[];
  initialCharId?: string;
  initialTab?: KnowledgeTab;
  initialQuery?: string;
}) {
  const fallback = characters[0]?.id ?? "";
  const [charId, setCharId] = useState(
    characters.some((c) => c.id === initialCharId) ? initialCharId! : fallback,
  );
  const [tab, setTab] = useState<KnowledgeTab>(
    TABS.some((t) => t.key === initialTab) ? initialTab! : "research",
  );
  const [query, setQuery] = useState(initialQuery ?? "");
  const [filter, setFilter] = useState<KnownFilter>("all");

  const character = characters.find((c) => c.id === charId) ?? characters[0];
  const q = query.trim().toLowerCase();

  if (!character) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <StickyMenu>
        <div className="flex flex-wrap gap-1.5">
          {characters.map((c) => {
            const active = c.id === character.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCharId(c.id)}
                className={`rounded-lg border px-2.5 py-1 text-sm ${
                  active
                    ? "border-accent/50 bg-accent-soft text-accent"
                    : "border-border text-fg-muted hover:border-accent/30 hover:text-fg"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
                  tab === t.key ? "bg-accent-soft text-accent" : "text-fg-subtle hover:text-fg"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter this tab…"
              className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "known", "missing"] as const).map((key) => (
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
        <p className="mt-2 text-xs text-fg-subtle">
          {character.scribingCount > 0
            ? `${character.scribingCount} scribing scripts already scanned — see `
            : "Scribing scripts are already on the character sheet and in "}
          <Link href="/encyclopedia/scribing" className="text-accent hover:underline">
            Encyclopedia → Scribing
          </Link>
          . Outfit Styles are account-wide on{" "}
          <Link href="/styles" className="text-accent hover:underline">
            Styles
          </Link>
          .
        </p>
      </StickyMenu>

      <PageScroll>
        {!character.scanned ? (
          <Card className="p-4 text-sm text-fg-muted">
            {character.name} has not been logged out with Snapshot 0.9.28 yet. Research, motifs, and
            recipes stay unknown until that scan.
          </Card>
        ) : tab === "research" ? (
          <ResearchPanel research={character.research} query={q} filter={filter} />
        ) : tab === "motifs" ? (
          <MotifPanel styles={character.motifs} query={q} filter={filter} />
        ) : (
          <RecipePanel
            lists={tab === "plans" ? character.plans : character.recipes}
            query={q}
            filter={filter}
            empty={tab === "plans" ? "No furnishing plans in the last scan." : "No recipes in the last scan."}
          />
        )}
      </PageScroll>
    </div>
  );
}

function matchesFilter(known: boolean, filter: KnownFilter): boolean {
  if (filter === "known") return known;
  if (filter === "missing") return !known;
  return true;
}

function ResearchPanel({
  research,
  query,
  filter,
}: {
  research: PresentedResearch;
  query: string;
  filter: KnownFilter;
}) {
  if (research.crafts.length === 0) {
    return <Card className="p-4 text-sm text-fg-muted">No smithing research lines in the last scan.</Card>;
  }

  return (
    <div className="space-y-5">
      {research.inProgress.length > 0 && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
            In progress · as of last logout
          </h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {research.inProgress.map((row) => (
              <li key={`${row.craft}-${row.line}-${row.trait}`} className="flex justify-between gap-3">
                <span className="text-fg">
                  {row.craftName} · {row.line} · {row.trait}
                </span>
                <span className="text-fg-subtle">
                  {row.remainingSeconds != null
                    ? `${formatResearchRemaining(row.remainingSeconds)} left`
                    : "researching"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {research.crafts.map((craft) => (
        <section key={craft.craft}>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-fg">{craft.name}</h3>
            <p className="text-xs text-fg-subtle">
              {craft.known}/{craft.total} known
              {craft.researching > 0 ? ` · ${craft.researching} researching` : ""}
              {craft.maxSlots > 0 ? ` · ${craft.maxSlots} slots` : ""}
            </p>
          </div>
          <div className="space-y-3">
            {craft.groups.map((group, gi) => {
              const lines = group.lines.filter((line) => {
                if (query && !line.name.toLowerCase().includes(query) && !group.traits.some((t) => t.toLowerCase().includes(query))) {
                  return false;
                }
                if (filter === "all") return true;
                return line.traits.some((t) => matchesFilter(t.known, filter) || (filter === "missing" && t.researching));
              });
              if (lines.length === 0) return null;
              return (
                <Card key={`${craft.craft}-${gi}`} className="overflow-x-auto">
                  <table className="w-full min-w-[36rem] border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-fg-subtle">
                        <th className="px-3 py-2 font-medium">Line</th>
                        {group.traits.map((trait) => (
                          <th key={trait} className="px-1 py-2 text-center font-medium">
                            {trait}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((line) => (
                        <tr key={line.name} className="border-b border-border/70 last:border-0">
                          <td className="px-3 py-1.5 font-medium text-fg">{line.name}</td>
                          {line.traits.map((trait) => (
                            <td key={trait.name} className="px-1 py-1.5 text-center">
                              <TraitCell known={trait.known} researching={trait.researching} name={trait.name} remaining={trait.remainingSeconds} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function TraitCell({
  known,
  researching,
  name,
  remaining,
}: {
  known: boolean;
  researching: boolean;
  name: string;
  remaining?: number;
}) {
  const title = researching
    ? `${name} · researching${remaining != null ? ` · ${formatResearchRemaining(remaining)} left at last logout` : ""}`
    : known
      ? `${name} · known`
      : `${name} · unknown`;
  if (known) {
    return (
      <span title={title} className="inline-flex h-5 w-5 items-center justify-center rounded border border-ok/40 bg-ok/10 text-ok">
        <Check className="h-3 w-3" />
      </span>
    );
  }
  if (researching) {
    return (
      <span
        title={title}
        className="inline-flex h-5 w-5 items-center justify-center rounded border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      >
        <Minus className="h-3 w-3" />
      </span>
    );
  }
  return (
    <span title={title} className="inline-flex h-5 w-5 items-center justify-center rounded border border-border text-fg-subtle">
      <span className="h-1 w-1 rounded-full bg-fg-subtle/50" />
    </span>
  );
}

function MotifPanel({
  styles,
  query,
  filter,
}: {
  styles: MotifStyle[];
  query: string;
  filter: KnownFilter;
}) {
  const visible = useMemo(() => {
    return styles.filter((style) => {
      if (query && !style.name.toLowerCase().includes(query) && !style.chapters.some((c) => c.name.toLowerCase().includes(query))) {
        return false;
      }
      if (filter === "known") return style.known > 0;
      if (filter === "missing") return style.known < style.total;
      return true;
    });
  }, [styles, query, filter]);

  if (styles.length === 0) {
    return <Card className="p-4 text-sm text-fg-muted">No crafting motifs in the Lore Library scan.</Card>;
  }

  return (
    <ul className="space-y-2">
      {visible.map((style) => {
        const complete = style.total > 0 && style.known === style.total;
        return (
          <li key={style.name}>
            <Card className="p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-medium text-fg">{style.name}</h3>
                <p className="text-xs text-fg-subtle">
                  {style.known}/{style.total}
                  {complete ? " · complete" : ""}
                </p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {style.chapters.map((chapter) => (
                  <span
                    key={chapter.name}
                    className={`rounded border px-1.5 py-0.5 text-[11px] ${
                      chapter.known
                        ? "border-ok/40 bg-ok/10 text-ok"
                        : "border-border text-fg-subtle"
                    }`}
                  >
                    {chapter.name}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-fg-subtle">
                Cosmetic unlocks for this look live on{" "}
                <Link href={`/styles?q=${encodeURIComponent(style.name)}`} className="text-accent hover:underline">
                  Outfit Styles
                </Link>
                {motifKey(style.name) ? ` · ${style.name}` : ""}.
              </p>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

function RecipePanel({
  lists,
  query,
  filter,
  empty,
}: {
  lists: RecipeList[];
  query: string;
  filter: KnownFilter;
  empty: string;
}) {
  if (lists.length === 0) return <Card className="p-4 text-sm text-fg-muted">{empty}</Card>;

  return (
    <div className="space-y-4">
      {lists.map((list) => {
        const recipes = list.recipes.filter((recipe) => {
          if (query && !recipe.name.toLowerCase().includes(query) && !list.name.toLowerCase().includes(query)) {
            return false;
          }
          return matchesFilter(recipe.known, filter);
        });
        if (query && recipes.length === 0 && !list.name.toLowerCase().includes(query)) return null;
        return (
          <Card key={list.name} className="p-3">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-fg">{list.name}</h3>
              <p className="text-xs text-fg-subtle">
                {list.known}/{list.total}
              </p>
            </div>
            <ul className="columns-1 gap-x-6 sm:columns-2">
              {recipes.map((recipe) => (
                <li key={recipe.name} className="mb-1 flex items-center gap-2 text-sm">
                  {recipe.known ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-ok" />
                  ) : (
                    <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-border" />
                  )}
                  <span className={recipe.known ? recipeQualityClass(recipe.quality) : "text-fg-subtle"}>{recipe.name}</span>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
