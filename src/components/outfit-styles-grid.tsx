"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, Lock, Search, X } from "lucide-react";
import { Card, PageScroll, StickyMenu } from "@/components/ui";
import { GameIcon } from "@/components/game-icon";
import type { PresentedOutfitStyle, PresentedOutfitStyles } from "@/lib/knowledge/present";
import {
  OUTFIT_SLOTS,
  WEAPON_KINDS,
  OUTFIT_WEIGHTS,
  outfitFacets,
  type ArmorSlot,
  type OutfitFacets,
  type OutfitWeight,
  type WeaponKind,
} from "@/lib/game/outfits";

type UnlockFilter = "all" | "unlocked" | "locked";
type Kind = "armor" | "weapon";

interface Entry {
  style: PresentedOutfitStyle;
  group: string;
  motifKey: string;
  facets: OutfitFacets;
}

/** "High Elf Hat" under High Elf reads as "Hat". */
function shortName(name: string, group: string): string {
  if (group && name.toLowerCase().startsWith(group.toLowerCase() + " ")) return name.slice(group.length + 1);
  return name;
}

/**
 * Outfit styles the way the outfit station shows them: armor or weapons,
 * then weight and slot (or weapon type), grouped by style.
 */
export function OutfitStylesGrid({
  presented,
  motifKeys,
  initialQuery,
  contained = false,
}: {
  presented: PresentedOutfitStyles;
  motifKeys: string[];
  initialQuery?: string;
  /** Grow with the page instead of taking over the pane's scroll. */
  contained?: boolean;
}) {
  const knownMotifs = useMemo(() => new Set(motifKeys), [motifKeys]);
  const entries = useMemo<Entry[]>(
    () =>
      presented.categories.flatMap((c) =>
        c.groups.flatMap((g) =>
          g.styles.map((style) => ({ style, group: g.name, motifKey: g.motifKey, facets: outfitFacets(style, c.name) })),
        ),
      ),
    [presented],
  );

  const [kind, setKind] = useState<Kind>("armor");
  const [weight, setWeight] = useState<OutfitWeight | null>(null);
  const [slot, setSlot] = useState<ArmorSlot | null>(null);
  const [weapon, setWeapon] = useState<WeaponKind | null>(null);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [filter, setFilter] = useState<UnlockFilter>("all");

  const q = query.trim().toLowerCase();
  const matchesText = (e: Entry) => !q || e.style.name.toLowerCase().includes(q) || e.group.toLowerCase().includes(q);
  const matchesLock = (e: Entry) => (filter === "unlocked" ? e.style.unlocked : filter === "locked" ? !e.style.unlocked : true);

  // Each facet's counts respect every other choice, so the numbers say what a click will show.
  const base = entries.filter((e) => matchesText(e) && matchesLock(e));
  const ofKind = (k: Kind) => base.filter((e) => e.facets.kind === k);
  const armor = ofKind("armor");
  const weapons = ofKind("weapon");
  const passWeight = (e: Entry) => !weight || (e.facets.kind === "armor" && e.facets.weight === weight);
  const passSlot = (e: Entry) => !slot || (e.facets.kind === "armor" && e.facets.slot === slot);
  const passWeapon = (e: Entry) => !weapon || (e.facets.kind === "weapon" && e.facets.weapon === weapon);

  const shown = (kind === "armor" ? armor.filter((e) => passWeight(e) && passSlot(e)) : weapons.filter(passWeapon));
  const tally = (list: Entry[]) => ({ unlocked: list.filter((e) => e.style.unlocked).length, total: list.length });

  const byGroup = new Map<string, Entry[]>();
  for (const e of shown) byGroup.set(e.group, [...(byGroup.get(e.group) ?? []), e]);
  const groups = [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // A search that only matches outside the current filters says so, instead of an empty page.
  const elsewhere = q && shown.length === 0 ? base.length : 0;
  const clearFacets = () => {
    setWeight(null);
    setSlot(null);
    setWeapon(null);
    const other = kind === "armor" ? weapons : armor;
    if ((kind === "armor" ? armor : weapons).length === 0 && other.length > 0) setKind(kind === "armor" ? "weapon" : "armor");
  };

  if (entries.length === 0) {
    return <Card className="p-4 text-sm text-fg-muted">No Outfit Styles in the last scan.</Card>;
  }

  const pill = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] transition-colors ${
      on ? "bg-accent-soft text-fg ring-1 ring-inset ring-accent/40" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
    }`;
  const count = (n: { unlocked: number; total: number }) => (
    <span className="tabular-nums text-[11px] text-fg-subtle">
      {n.unlocked}/{n.total}
    </span>
  );

  const toolbar = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Armor or weapons">
          {(["armor", "weapon"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={pill(kind === k)}>
              {k === "armor" ? "Armor" : "Weapons"} {count(tally(k === "armor" ? armor : weapons))}
            </button>
          ))}
        </div>
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search styles"
            aria-label="Search styles"
            className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-8 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <div className="flex rounded-lg border border-border bg-surface p-0.5" role="group" aria-label="Unlocked">
          {(["all", "unlocked", "locked"] as const).map((key) => (
            <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)} className={pill(filter === key)}>
              {key === "all" ? "All" : key === "unlocked" ? "Unlocked" : "Locked"}
            </button>
          ))}
        </div>
      </div>

      {kind === "armor" ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Weight">
            <span className="mr-1 text-[12px] text-fg-subtle">Weight</span>
            <button type="button" aria-pressed={!weight} onClick={() => setWeight(null)} className={pill(!weight)}>
              Any
            </button>
            {OUTFIT_WEIGHTS.map((w) => {
              const n = tally(armor.filter((e) => passSlot(e) && e.facets.kind === "armor" && e.facets.weight === w.id));
              return (
                <button
                  key={w.id}
                  type="button"
                  aria-pressed={weight === w.id}
                  onClick={() => setWeight(weight === w.id ? null : w.id)}
                  disabled={n.total === 0 && weight !== w.id}
                  className={`${pill(weight === w.id)} disabled:opacity-40`}
                >
                  {w.label} {count(n)}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Slot">
            <span className="mr-1 text-[12px] text-fg-subtle">Slot</span>
            <button type="button" aria-pressed={!slot} onClick={() => setSlot(null)} className={pill(!slot)}>
              Any
            </button>
            {OUTFIT_SLOTS.map((s) => {
              const n = tally(armor.filter((e) => passWeight(e) && e.facets.kind === "armor" && e.facets.slot === s.id));
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={slot === s.id}
                  onClick={() => setSlot(slot === s.id ? null : s.id)}
                  disabled={n.total === 0 && slot !== s.id}
                  className={`${pill(slot === s.id)} disabled:opacity-40`}
                >
                  {s.label} {count(n)}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Weapon type">
          <span className="mr-1 text-[12px] text-fg-subtle">Type</span>
          <button type="button" aria-pressed={!weapon} onClick={() => setWeapon(null)} className={pill(!weapon)}>
            Any
          </button>
          {WEAPON_KINDS.map((w) => {
            const n = tally(weapons.filter((e) => e.facets.kind === "weapon" && e.facets.weapon === w.id));
            if (n.total === 0 && weapon !== w.id) return null;
            return (
              <button key={w.id} type="button" aria-pressed={weapon === w.id} onClick={() => setWeapon(weapon === w.id ? null : w.id)} className={pill(weapon === w.id)}>
                {w.label} {count(n)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const list = (
    <>
      <p className="text-[13px] text-fg-subtle">
        {shown.length} {shown.length === 1 ? "style" : "styles"} in {groups.length} {groups.length === 1 ? "motif" : "motifs"} ·{" "}
        {tally(shown).unlocked} unlocked
      </p>
      {groups.map(([name, list]) => {
        const t = tally(list);
        const motifKey = list[0].motifKey;
        return (
          <section key={name}>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-[14px] font-medium text-fg">{name}</h3>
              <span className={`text-[12px] tabular-nums ${t.unlocked === t.total ? "text-ok" : "text-fg-subtle"}`}>
                {t.unlocked}/{t.total}
              </span>
              {knownMotifs.has(motifKey) ? (
                <Link href={`/knowledge?tab=motifs&q=${encodeURIComponent(name)}`} className="text-[12px] text-accent hover:underline">
                  Motif known
                </Link>
              ) : null}
            </div>
            <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {list.map(({ style }) => (
                <li key={style.collectibleId}>
                  <div
                    title={`${style.name} · ${style.unlocked ? "Unlocked" : "Locked"}`}
                    className={`flex items-center gap-2 rounded-lg border py-1 pl-1 pr-2 ${
                      style.unlocked ? "border-border bg-surface" : "border-border/40 bg-transparent"
                    }`}
                  >
                    <span className={style.unlocked ? "" : "opacity-40 grayscale"}>
                      <GameIcon name={style.name} icon={style.icon ?? undefined} size={32} />
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-[13px] ${style.unlocked ? "text-fg" : "text-fg-subtle"}`}>
                      {shortName(style.name, name)}
                    </span>
                    {style.unlocked ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-ok" aria-label="Unlocked" />
                    ) : (
                      <Lock className="h-3 w-3 shrink-0 text-fg-subtle/70" aria-label="Locked" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {shown.length === 0 ? (
        <Card className="p-4 text-sm text-fg-muted">
          {elsewhere > 0 ? (
            <>
              “{query.trim()}” matches {elsewhere} {elsewhere === 1 ? "style" : "styles"} outside these filters.{" "}
              <button type="button" onClick={clearFacets} className="text-accent hover:underline">
                Show {elsewhere === 1 ? "it" : "them"}
              </button>
            </>
          ) : (
            "No styles match these filters."
          )}
        </Card>
      ) : null}
    </>
  );

  return (
    <div className={contained ? "flex flex-col gap-4" : "flex min-h-0 flex-1 flex-col"}>
      {contained ? toolbar : <StickyMenu>{toolbar}</StickyMenu>}
      {contained ? <div className="space-y-5">{list}</div> : <PageScroll><div className="space-y-5">{list}</div></PageScroll>}
    </div>
  );
}
