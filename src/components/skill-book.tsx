"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { GameIcon } from "@/components/game-icon";
import { SourceBadge } from "@/components/source-badge";
import { EsoText } from "@/components/eso-text";
import type { AbilitySlotView, AbilityView, SkillCategoryView, SkillLineView } from "@/lib/skills/present";
import { romanRank } from "@/lib/skills/ability";
import type { CatalogSource } from "@/lib/catalog/schema";

function RankPips({ rank, max = 4 }: { rank: number | null; max?: number }) {
  const filled = rank ?? 0;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i < filled ? "bg-accent" : "bg-border-strong/70"}`}
          />
        ))}
      </span>
      <span className="tabular-nums text-xs text-fg-muted">Rank {romanRank(rank)}</span>
    </span>
  );
}

function slotToShow(ability: AbilityView, picked: number | null): AbilitySlotView | null {
  if (ability.morphs.length === 0) return null;
  if (picked != null) return ability.morphs.find((s) => s.slot === picked) ?? null;
  return ability.morphs.find((s) => s.current) ?? ability.morphs.find((s) => s.purchased) ?? ability.morphs[0];
}

function AbilityDetail({
  ability,
  lastSeen,
  slot,
  onPick,
}: {
  ability: AbilityView;
  lastSeen: number | null;
  slot: number | null;
  onPick: (slot: number) => void;
}) {
  const shown = slotToShow(ability, slot);
  const name = shown?.name ?? ability.name;
  const icon = shown?.icon || ability.icon || ability.morphs.find((m) => m.icon)?.icon;
  const description = shown?.description || ability.description;
  const purchased = shown ? shown.purchased : ability.purchased;
  const rank = shown?.rank ?? ability.rank;
  const source = ability.descriptionSource;

  return (
    <div className="w-full min-w-0 rounded-lg border border-border bg-surface/60 p-4">
      <div className="flex items-start gap-3">
        <span className={purchased ? "" : "opacity-40 grayscale"}>
          <GameIcon name={name} icon={icon} size={56} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`text-base font-medium ${purchased ? "text-fg" : "text-fg-subtle"}`}>{name}</h3>
            {ability.passive && <Badge tone="muted">Passive</Badge>}
            {shown && shown.slot > 0 && purchased && <Badge tone="accent">Morph</Badge>}
            {!purchased && <Badge tone="muted">Not purchased</Badge>}
            {ability.skillStyle && (
              <span className="inline-flex items-center gap-1 text-xs text-accent">
                <Sparkles className="h-3 w-3" /> {ability.skillStyle}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {ability.passive ? (
              <span className="text-xs tabular-nums text-fg-muted">
                Rank {ability.rank}
                {ability.maxRank != null ? ` / ${ability.maxRank}` : ""}
              </span>
            ) : (
              <RankPips rank={rank} />
            )}
            {!purchased && <span className="text-xs text-fg-subtle">No skill point spent</span>}
          </div>
        </div>
      </div>

      {description ? (
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          <EsoText text={description} />
        </p>
      ) : (
        <p className="mt-3 text-sm text-fg-subtle">
          Tooltip not captured
          {lastSeen ? " in this snapshot" : " yet"}. Log this character out (or ReloadUI) with the addon to fill it
          from the game.
        </p>
      )}
      {source !== "unknown" && source !== "ingame" && (
        <div className="mt-2">
          <SourceBadge source={source as CatalogSource} />
        </div>
      )}

      {ability.morphs.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ability.morphs.map((m) => {
            const active = (shown?.slot ?? -1) === m.slot;
            return (
              <button
                key={m.slot}
                type="button"
                onClick={() => onPick(m.slot)}
                className={`flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs ${
                  active ? "border-accent/60 bg-accent-soft" : "border-border bg-surface hover:border-border-strong"
                } ${m.purchased ? "" : "opacity-60"}`}
              >
                <span className={m.purchased ? "" : "grayscale"}>
                  <GameIcon name={m.name} icon={m.icon ?? ability.icon} size={28} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wider text-fg-subtle">{m.label}</span>
                  <span className={`block truncate ${m.purchased ? "text-fg" : "text-fg-subtle"}`}>{m.name}</span>
                  <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <RankPips rank={m.rank} />
                    {!m.purchased && <span className="text-[10px] text-fg-subtle">Not owned</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm transition ${
        active ? "bg-accent-soft font-medium text-accent" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

export function SkillBook({
  categories,
  lastSeen,
}: {
  categories: SkillCategoryView[];
  lastSeen: number | null;
}) {
  const [catName, setCatName] = useState(categories[0]?.name ?? "");
  const category = categories.find((c) => c.name === catName) ?? categories[0];
  const [lineName, setLineName] = useState(category?.lines[0]?.name ?? "");
  const line: SkillLineView | undefined =
    category?.lines.find((l) => l.name === lineName) ?? category?.lines[0];
  const [abilityIndex, setAbilityIndex] = useState(0);
  const [morphSlot, setMorphSlot] = useState<number | null>(null);

  if (categories.length === 0) {
    return (
      <section>
        <SectionTitle>Skills</SectionTitle>
        <Card className="px-4 py-6 text-sm text-fg-muted">No skills captured yet.</Card>
      </section>
    );
  }

  const ability = line?.abilities[Math.min(abilityIndex, Math.max(0, (line?.abilities.length ?? 1) - 1))];

  function pickCategory(name: string) {
    setCatName(name);
    const next = categories.find((c) => c.name === name);
    setLineName(next?.lines[0]?.name ?? "");
    setAbilityIndex(0);
    setMorphSlot(null);
  }

  function pickLine(name: string) {
    setLineName(name);
    setAbilityIndex(0);
    setMorphSlot(null);
  }

  return (
    <section className="w-full min-w-0">
      <SectionTitle>Skills</SectionTitle>
      <Card className="w-full min-w-0 p-4">
        <div role="tablist" aria-label="Skill type" className="mb-4 flex flex-wrap gap-1 border-b border-border pb-3">
          {categories.map((c) => (
            <TabButton key={c.name} active={c.name === category?.name} onClick={() => pickCategory(c.name)}>
              {c.name}
            </TabButton>
          ))}
        </div>

        <div className="grid w-full min-w-0 min-h-[32rem] gap-4 lg:h-[42rem] lg:min-h-[42rem] lg:grid-cols-[12.5rem_16rem_minmax(0,1fr)] lg:overflow-hidden">
          <ul
            className="flex min-h-0 min-w-0 gap-1 overflow-x-auto lg:block lg:space-y-1 lg:overflow-y-auto lg:pr-1"
            aria-label="Skill line"
          >
            {category?.lines.map((l) => {
              const known = l.abilities.filter((a) => a.purchased).length;
              const active = l.name === line?.name;
              return (
                <li key={l.name} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    onClick={() => pickLine(l.name)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm ${
                      active ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
                    }`}
                  >
                    <span className="min-w-0 truncate">
                      {l.name}
                      {l.subclassed ? <span className="text-accent"> ·</span> : null}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-fg-subtle">{l.rank}</span>
                  </button>
                  {active && l.abilities.length > 0 && (
                    <p className="px-2.5 pb-1 text-[11px] text-fg-subtle">
                      {known}/{l.abilities.length} purchased
                    </p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="min-h-0 min-w-0 lg:overflow-y-auto lg:pr-1">
            {line && line.abilities.length === 0 && (
              <p className="text-sm text-fg-muted">No abilities captured for this line.</p>
            )}
            {line && line.abilities.length > 0 && (
              <ul className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border">
                {line.abilities.map((a, i) => {
                  const selected = i === Math.min(abilityIndex, line.abilities.length - 1);
                  const face =
                    a.morphs.find((s) => s.current) ??
                    a.morphs.find((s) => s.purchased) ??
                    a.morphs.find((s) => (s.rank ?? 0) >= 1) ??
                    a.morphs[0];
                  const label = face?.name ?? a.name;
                  const icon = face?.icon || a.icon || a.morphs.find((m) => m.icon)?.icon;
                  const rank = face?.rank ?? a.rank;
                  return (
                    <li key={`${a.name}-${i}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setAbilityIndex(i);
                          setMorphSlot(null);
                        }}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                          selected ? "bg-accent-soft" : "hover:bg-surface-2/60"
                        }`}
                      >
                        <span className={a.purchased ? "" : "opacity-40 grayscale"}>
                          <GameIcon name={label} icon={icon} size={36} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate text-sm ${a.purchased ? "text-fg" : "text-fg-subtle"}`}>
                            {label}
                          </span>
                          <span className="text-[11px] text-fg-subtle">
                            {a.passive ? "Passive" : face && face.slot > 0 ? "Morph" : "Base"}
                            {!a.purchased ? " · not purchased" : ""}
                          </span>
                        </span>
                        {a.passive ? (
                          <span className="text-xs tabular-nums text-fg-muted">{a.rank}</span>
                        ) : (
                          <RankPips rank={rank} />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="min-h-0 min-w-0 lg:overflow-y-auto">
            {line && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {line.href ? (
                    <Link href={line.href} className="font-medium text-fg hover:text-accent hover:underline">
                      {line.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-fg">{line.name}</span>
                  )}
                  {line.subclassed && <Badge tone="accent">Subclassed</Badge>}
                </div>
                <span className="text-xs text-fg-subtle">Line rank {line.rank}</span>
              </div>
            )}

            {line && ability && (
              <AbilityDetail
                ability={ability}
                lastSeen={lastSeen}
                slot={morphSlot}
                onPick={setMorphSlot}
              />
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}
