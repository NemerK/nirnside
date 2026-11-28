"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { classColor } from "@/lib/classes";
import type { CatalogRecipe } from "@/lib/catalog/schema";
import {
  KnowledgeDetail,
  listTally,
  motifTally,
  researchTally,
  type CellTally,
  type KnowledgeCharacterView,
  type KnowledgeTab,
} from "@/components/knowledge-board";

const KINDS: { key: KnowledgeTab; label: string; tally: (c: KnowledgeCharacterView) => CellTally }[] = [
  { key: "research", label: "Research", tally: researchTally },
  { key: "motifs", label: "Motifs", tally: motifTally },
  { key: "recipes", label: "Recipes", tally: (c) => listTally(c.scanned, c.recipes) },
  { key: "plans", label: "Plans", tally: (c) => listTally(c.scanned, c.plans) },
];

function Meter({ tally, label }: { tally: CellTally; label: string }) {
  if (!tally.scanned) return <span className="text-[11px] text-fg-subtle">{label} ?</span>;
  const pct = tally.total > 0 ? Math.round((tally.known / tally.total) * 100) : 0;
  return (
    <span className="block min-w-0" title={`${label}: ${tally.known} of ${tally.total}`}>
      <span className="flex items-baseline justify-between gap-1 text-[11px]">
        <span className="truncate text-fg-subtle">{label}</span>
        <span className="tabular-nums text-fg-muted">{pct}%</span>
      </span>
      <span className="mt-0.5 block h-[3px] rounded-full bg-meter-track" aria-hidden>
        <span
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, background: pct === 100 ? "var(--ok)" : "var(--meter)" }}
        />
      </span>
    </span>
  );
}

/**
 * Craft knowledge the way Atlas organizes it: every character with their
 * research, motifs, recipes and plans at a glance, and the open character's
 * trait grid, motif chapters, recipes and plans beside the list.
 */
export function PartyKnowledge({
  characters,
  initialCharId,
  initialTab,
  recipeBook = [],
}: {
  characters: KnowledgeCharacterView[];
  initialCharId?: string;
  initialTab?: KnowledgeTab;
  /** Every recipe and plan from the catalog scan; empty until one. */
  recipeBook?: CatalogRecipe[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [openId, setOpenId] = useState(
    characters.find((c) => c.id === initialCharId)?.id ?? characters.find((c) => c.scanned)?.id ?? characters[0]?.id,
  );
  const open = characters.find((c) => c.id === openId);

  function choose(id: string) {
    setOpenId(id);
    // Keep the choice in the address, so back and reload land on the same character.
    const sp = new URLSearchParams(params.toString());
    sp.set("char", id);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }

  if (characters.length === 0) return null;

  return (
    <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav
        aria-label="Characters"
        className="max-h-72 overflow-y-auto pr-1 lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:self-start"
      >
        <ul className="space-y-1">
          {characters.map((c) => {
            const on = c.id === openId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => choose(c.id)}
                  aria-current={on ? "true" : undefined}
                  className={`w-full rounded-lg px-3 py-2 text-left ${
                    on ? "bg-accent-soft ring-1 ring-inset ring-accent/40" : "hover:bg-surface-2/60"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: classColor(c.className) ?? "var(--border)" }} aria-hidden />
                    <span className={`min-w-0 flex-1 truncate text-[13.5px] ${on ? "text-fg" : "text-fg-muted"}`}>{c.name}</span>
                    {!c.scanned ? <span className="shrink-0 text-[11px] text-fg-subtle">not scanned</span> : null}
                  </span>
                  {c.scanned ? (
                    <span className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 pl-4">
                      {KINDS.map((k) => (
                        <Meter key={k.key} label={k.label} tally={k.tally(c)} />
                      ))}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="party-module min-w-0 px-5 py-4">
        {open ? (
          <>
            <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="font-display text-[24px] text-fg">{open.name}</h2>
              <span className="text-[13px]" style={{ color: classColor(open.className) ?? undefined }}>
                {open.className}
              </span>
            </header>
            <KnowledgeDetail key={open.id} character={open} initialTab={initialTab} recipeBook={recipeBook} fill />
          </>
        ) : null}
      </section>
    </div>
  );
}
