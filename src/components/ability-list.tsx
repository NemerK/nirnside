import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui";
import type { SkillMorph } from "@/lib/snapshot/schema";
import {
  MAX_ABILITY_RANK,
  abilityIsKnown,
  displayAbility,
  romanRank,
  slotLabel,
  xpProgress,
} from "@/lib/skills/ability";

function RankPips({ rank, max = MAX_ABILITY_RANK }: { rank: number | null; max?: number }) {
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

function AbilityRow({ ability }: { ability: SkillMorph }) {
  const known = abilityIsKnown(ability);
  const face = displayAbility(ability);
  const slots = ability.morphs ?? [];
  const title = ability.skillStyle ? `Skill style: ${ability.skillStyle}` : undefined;

  return (
    <li
      className={`rounded-lg border px-3 py-2.5 ${
        known ? "border-border bg-surface-2/50" : "border-border/60"
      }`}
      title={title}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-sm font-medium ${known ? "text-fg" : "text-fg-subtle"}`}>{face.name}</span>
        {face.showingMorph && <span className="text-accent">◆</span>}
        {ability.passive && <Badge tone="muted">Passive</Badge>}
        {!known && <Badge tone="muted">Not purchased</Badge>}
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
        {!ability.passive && slots.length === 0 && known && (
          <span className="ml-auto">
            <RankPips rank={ability.rank > 0 ? ability.rank : null} />
          </span>
        )}
      </div>

      {!ability.passive && slots.length > 0 && (
        <ul className="mt-2 space-y-1">
          {slots.map((slot) => {
            const current = face.morphSlot === slot.slot;
            const xp = slot.purchased ? xpProgress(slot) : null;
            return (
              <li
                key={slot.slot}
                className={`grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-1.5 py-1 text-xs ${
                  current ? "bg-accent-soft" : ""
                }`}
              >
                <span className="text-fg-subtle">{slotLabel(slot.slot)}</span>
                <span className={`truncate ${slot.purchased ? "text-fg" : "text-fg-subtle"}`}>
                  {slot.name}
                  {current && known && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wider text-accent">slotted</span>
                  )}
                </span>
                <span className="flex w-16 flex-col items-end gap-0.5">
                  <RankPips rank={slot.purchased ? slot.rank : null} />
                  {xp && (
                    <span className="h-1 w-full overflow-hidden rounded-full bg-border">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${Math.round((xp.value / xp.max) * 100)}%` }}
                      />
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export function AbilityList({ abilities }: { abilities: SkillMorph[] }) {
  if (abilities.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2">
      {abilities.map((ability, i) => (
        <AbilityRow key={i} ability={ability} />
      ))}
    </ul>
  );
}
