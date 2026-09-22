"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { GameIcon } from "@/components/game-icon";
import { SourceBadge } from "@/components/source-badge";
import type { AbilityView, SkillCategoryView, SkillLineView } from "@/lib/skills/present";
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
      <span className="tabular-nums text-xs text-fg-muted">{romanRank(rank)}</span>
    </span>
  );
}

function TooltipBody({
  ability,
  lastSeen,
}: {
  ability: AbilityView;
  lastSeen: number | null;
}) {
  const source = ability.descriptionSource;
  return (
    <div className="w-80 rounded-lg border border-accent/40 bg-bg-elev p-3 shadow-xl">
      <div className="flex items-start gap-2.5">
        <GameIcon name={ability.name} icon={ability.icon} size={40} />
        <div className="min-w-0">
          <div className="font-medium text-fg">{ability.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {ability.passive && <Badge tone="muted">Passive</Badge>}
            {ability.showingMorph && <Badge tone="accent">Morph</Badge>}
            {!ability.purchased && <Badge tone="muted">Not purchased</Badge>}
          </div>
        </div>
      </div>
      {ability.description ? (
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">{ability.description}</p>
      ) : (
        <p className="mt-2 text-sm text-fg-subtle">
          Tooltip not captured
          {lastSeen ? " in this snapshot" : " yet"}
          . Log this character out (or ReloadUI) with the addon to fill it from the game.
        </p>
      )}
      {ability.morphs.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border pt-2">
          {ability.morphs.map((slot) => (
            <li key={slot.slot} className="flex items-start gap-2 text-xs">
              <GameIcon name={slot.name} icon={slot.icon ?? ability.icon} size={22} />
              <span className="min-w-0 flex-1">
                <span className={slot.purchased ? "text-fg" : "text-fg-subtle"}>
                  {slot.label}: {slot.name}
                </span>
                {slot.description && slot.description !== ability.description && (
                  <span className="mt-0.5 block text-fg-subtle">{slot.description}</span>
                )}
              </span>
              <span className="shrink-0 tabular-nums text-fg-muted">{slot.rankLabel}</span>
            </li>
          ))}
        </ul>
      )}
      {source !== "unknown" && source !== "ingame" && (
        <div className="mt-2">
          <SourceBadge source={source as CatalogSource} />
        </div>
      )}
    </div>
  );
}

function AbilityCard({ ability, lastSeen }: { ability: AbilityView; lastSeen: number | null }) {
  const ref = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  function show() {
    const box = ref.current?.getBoundingClientRect();
    if (box) {
      const width = 320;
    const estimatedHeight = 260;
    const left = Math.min(Math.max(8, box.left), Math.max(8, window.innerWidth - width - 8));
    let top = box.bottom + 8;
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, box.top - estimatedHeight - 8);
    }
    setPos({ top, left });
    }
    setOpen(true);
  }

  return (
    <article
      ref={ref}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onFocus={show}
      onBlur={() => setOpen(false)}
      className={`relative rounded-lg border p-3 outline-none focus-visible:border-accent ${
        ability.purchased ? "border-border bg-surface-2/50" : "border-border/60"
      }`}
    >
      <div className="flex items-start gap-3">
        <GameIcon name={ability.name} icon={ability.icon} size={48} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-sm font-medium ${ability.purchased ? "text-fg" : "text-fg-subtle"}`}>
              {ability.name}
            </span>
            {ability.showingMorph && <span className="text-accent">◆</span>}
            {ability.passive && <Badge tone="muted">Passive</Badge>}
            {!ability.purchased && <Badge tone="muted">Not purchased</Badge>}
            {ability.skillStyle && (
              <span className="inline-flex items-center gap-1 text-xs text-accent">
                <Sparkles className="h-3 w-3" /> {ability.skillStyle}
              </span>
            )}
            {ability.passive && (
              <span className="ml-auto text-xs tabular-nums text-fg-muted">
                Rank {ability.rank}
                {ability.maxRank != null ? ` / ${ability.maxRank}` : ""}
              </span>
            )}
            {!ability.passive && ability.morphs.length === 0 && ability.purchased && (
              <span className="ml-auto">
                <RankPips rank={ability.rank > 0 ? ability.rank : null} />
              </span>
            )}
          </div>
          {!ability.passive && ability.morphs.length > 0 && (
            <ul className="mt-2 space-y-1">
              {ability.morphs.map((slot) => (
                <li
                  key={slot.slot}
                  className={`flex items-center gap-2 rounded-md px-1 py-0.5 text-xs ${
                    slot.current ? "bg-accent-soft" : ""
                  }`}
                >
                  <span className="w-14 shrink-0 text-fg-subtle">{slot.label}</span>
                  <span className={`min-w-0 flex-1 truncate ${slot.purchased ? "text-fg" : "text-fg-subtle"}`}>
                    {slot.name}
                    {slot.current && <span className="ml-1.5 text-[10px] uppercase tracking-wider text-accent">slotted</span>}
                  </span>
                  <RankPips rank={slot.rank} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {open &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[80]"
            style={{ top: pos.top, left: pos.left }}
            role="tooltip"
          >
            <TooltipBody ability={ability} lastSeen={lastSeen} />
          </div>,
          document.body,
        )}
    </article>
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

  useEffect(() => {
    if (!category) return;
    if (!category.lines.some((l) => l.name === lineName)) {
      setLineName(category.lines[0]?.name ?? "");
    }
  }, [category, lineName]);

  if (categories.length === 0) {
    return (
      <section>
        <SectionTitle>Skills</SectionTitle>
        <Card className="px-4 py-6 text-sm text-fg-muted">No skills captured yet.</Card>
      </section>
    );
  }

  const line: SkillLineView | undefined = category?.lines.find((l) => l.name === lineName) ?? category?.lines[0];

  return (
    <section>
      <SectionTitle>Skills</SectionTitle>
      <Card className="overflow-visible p-4">
      <div className="-mx-4 -mt-4 mb-4 border-b border-border bg-surface px-4 pb-3 pt-4">
        <div role="tablist" aria-label="Skill type" className="flex flex-wrap gap-1">
          {categories.map((c) => (
            <TabButton
              key={c.name}
              active={c.name === category?.name}
              onClick={() => {
                setCatName(c.name);
                setLineName(c.lines[0]?.name ?? "");
              }}
            >
              {c.name}
            </TabButton>
          ))}
        </div>
        {category && category.lines.length > 0 && (
          <div role="tablist" aria-label="Skill line" className="mt-3 flex flex-wrap gap-1 border-t border-border pt-3">
            {category.lines.map((l) => (
              <TabButton key={l.name} active={l.name === line?.name} onClick={() => setLineName(l.name)}>
                {l.name}
                {l.subclassed ? " · subclass" : ""}
              </TabButton>
            ))}
          </div>
        )}
        </div>
        {line && (
          <div className="mt-4">
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
              <span className="text-xs text-fg-subtle">Rank {line.rank}</span>
            </div>
            {line.abilities.length === 0 ? (
              <p className="text-sm text-fg-muted">No abilities captured for this line.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                {line.abilities.map((ability, i) => (
                  <li key={`${ability.name}-${i}`}>
                    <AbilityCard ability={ability} lastSeen={lastSeen} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </section>
  );
}
