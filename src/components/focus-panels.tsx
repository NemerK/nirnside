import Link from "next/link";
import { CalendarClock, FlaskConical, Sparkles, Star } from "lucide-react";
import type { Character } from "@/lib/snapshot/schema";
import { Badge, Card, ProgressBar, SectionTitle } from "@/components/ui";
import {
  formatResearchRemaining,
  presentMotifs,
  presentRecipeLists,
  presentResearch,
} from "@/lib/knowledge/present";

/**
 * Server-side panels of the Focus dashboard. Each one renders one "what I care
 * about" area for the focused character, straight from the last snapshot —
 * nothing is guessed, nothing is recomputed from outside the game data.
 */

/** ESO craft skill lines, in the game's own crafting-window order. */
const CRAFT_LINES = [
  "Blacksmithing",
  "Clothing",
  "Woodworking",
  "Jewelry Crafting",
  "Enchanting",
  "Alchemy",
  "Provisioning",
];

export function CraftingPanel({ character }: { character: Character }) {
  const byName = new Map(character.skillLines.map((l) => [l.name.toLowerCase(), l]));
  const craftLines = CRAFT_LINES.map((name) => {
    const line = byName.get(name.toLowerCase());
    return { name, rank: line?.rank ?? 0, found: !!line };
  });
  const research = presentResearch(character.research);
  const scanned = character.lastSeen != null;
  const hasAny = craftLines.some((l) => l.found) || research.total > 0;

  return (
    <section className="mb-6">
      <SectionTitle>Crafting</SectionTitle>
      {!scanned || !hasAny ? (
        <Card className="px-4 py-6 text-sm text-fg-muted">
          Nothing captured yet — log this character out (or ReloadUI) with the addon to fill it from the game.
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
              <FlaskConical className="h-3.5 w-3.5" /> Craft levels
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {craftLines.map((l) => (
                <div key={l.name}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className={l.found ? "text-fg" : "text-fg-subtle"}>{l.name}</span>
                    <span className="text-xs tabular-nums text-fg-muted">
                      {l.found ? `Rank ${l.rank} / 50` : "Not discovered"}
                    </span>
                  </div>
                  <ProgressBar value={l.rank} max={50} />
                </div>
              ))}
            </div>
          </Card>

          {research.total > 0 && (
            <Card className="p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                  Trait research
                </span>
                <span className="text-xs tabular-nums text-fg-muted">
                  {research.known}/{research.total} traits known
                </span>
              </div>
              <div className="mb-4">
                <ProgressBar value={research.known} max={research.total} />
              </div>
              <ul className="divide-y divide-border/60">
                {research.crafts.map((craft) => (
                  <li key={craft.craft} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                    <span className="text-fg">{craft.name}</span>
                    <span className="text-xs tabular-nums text-fg-muted">
                      {craft.known}/{craft.total} known
                      {craft.researching > 0 ? ` · ${craft.researching} researching` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {research.inProgress.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
                  {research.inProgress.map((r) => (
                    <li
                      key={`${r.craft}-${r.line}-${r.trait}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate text-fg-muted">
                        {r.craftName} · {r.line} · {r.trait}
                      </span>
                      <span className="shrink-0 inline-flex items-center gap-1 text-xs text-fg-subtle">
                        <CalendarClock className="h-3 w-3" />
                        {r.remainingSeconds != null
                          ? `${formatResearchRemaining(r.remainingSeconds)} left at last logout`
                          : "Researching"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      )}
    </section>
  );
}

export interface FocusScript {
  id: string;
  name: string;
  slot: string;
  effect: string;
}

const SLOT_ORDER = ["focus", "signature", "affix"] as const;

export function ScribingPanel({ character, scripts }: { character: Character; scripts: FocusScript[] }) {
  const known = new Set(character.scribingScripts.map((s) => s.toLowerCase()));
  const groups = SLOT_ORDER.map((slot) => ({
    slot,
    list: scripts.filter((s) => s.slot === slot),
  }));

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <SectionTitle className="mb-0">Scribing</SectionTitle>
        <Link href="/encyclopedia/scribing" className="text-xs text-accent hover:underline">
          Combination matrix →
        </Link>
      </div>
      {scripts.length === 0 && character.scribingScripts.length === 0 ? (
        <Card className="px-4 py-6 text-sm text-fg-muted">
          No scribing data yet — the catalog page explains how to scan it in game.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {groups.map(({ slot, list }) => {
            if (list.length === 0) return null;
            const knownCount = list.filter((s) => known.has(s.name.toLowerCase())).length;
            return (
              <Card key={slot} className="p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                    <Sparkles className="h-3.5 w-3.5" /> {slot}
                  </span>
                  <span className="text-xs tabular-nums text-fg-muted">
                    {knownCount}/{list.length} collected
                  </span>
                </div>
                <div className="mb-3">
                  <ProgressBar value={knownCount} max={list.length} />
                </div>
                <ul className="space-y-1.5">
                  {list.map((s) =>
                    known.has(s.name.toLowerCase()) ? (
                      <li key={s.id} className="text-sm text-fg" title={s.effect}>
                        {s.name}
                      </li>
                    ) : (
                      <li key={s.id} className="text-sm text-fg-subtle opacity-70" title={s.effect}>
                        {s.name} <span className="text-xs">· missing</span>
                      </li>
                    ),
                  )}
                </ul>
              </Card>
            );
          })}
          {scripts.length === 0 && character.scribingScripts.length > 0 && (
            <Card className="p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                Scripts this character knows
              </div>
              <div className="flex flex-wrap gap-1.5">
                {character.scribingScripts.map((s, i) => (
                  <Badge key={i} tone="accent">
                    {s}
                  </Badge>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}

export function KnowledgePanel({ character }: { character: Character }) {
  const motifs = presentMotifs(character.motifs);
  const recipes = presentRecipeLists(character.recipeLists, "provisioning");
  const plans = presentRecipeLists(character.recipeLists, "furnishing");
  const research = presentResearch(character.research);
  const scanned = character.lastSeen != null;
  const hasAny = motifs.total > 0 || recipes.total > 0 || plans.total > 0 || research.total > 0;

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <SectionTitle className="mb-0">Knowledge</SectionTitle>
        <Link
          href={`/knowledge?char=${encodeURIComponent(character.id)}`}
          className="text-xs text-accent hover:underline"
        >
          Full grid →
        </Link>
      </div>
      {!scanned || !hasAny ? (
        <Card className="px-4 py-6 text-sm text-fg-muted">
          Nothing captured yet — log this character out (or ReloadUI) with the addon to fill it from the game.
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-fg-subtle">Research</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-fg">
                {research.total ? `${Math.round((research.known / research.total) * 100)}%` : "—"}
              </div>
              <div className="mt-0.5 text-xs text-fg-muted">
                {research.total ? `${research.known}/${research.total} traits` : "not captured"}
              </div>
            </Card>
            <Card className="px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-fg-subtle">Motifs</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-fg">
                {motifs.total ? `${Math.round((motifs.known / motifs.total) * 100)}%` : "—"}
              </div>
              <div className="mt-0.5 text-xs text-fg-muted">
                {motifs.total ? `${motifs.known}/${motifs.total} chapters` : "not captured"}
              </div>
            </Card>
            <Card className="px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-fg-subtle">Recipes</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-fg">
                {recipes.total ? `${Math.round((recipes.known / recipes.total) * 100)}%` : "—"}
              </div>
              <div className="mt-0.5 text-xs text-fg-muted">
                {recipes.total ? `${recipes.known}/${recipes.total} known` : "not captured"}
              </div>
            </Card>
            <Card className="px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-fg-subtle">Furnishing plans</div>
              <div className="mt-1 text-xl font-semibold tabular-nums text-fg">
                {plans.total ? `${Math.round((plans.known / plans.total) * 100)}%` : "—"}
              </div>
              <div className="mt-0.5 text-xs text-fg-muted">
                {plans.total ? `${plans.known}/${plans.total} known` : "not captured"}
              </div>
            </Card>
          </div>

          {motifs.styles.length > 0 && (
            <Card className="p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                Motif chapters by style
              </div>
              <ul className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                {motifs.styles.map((style, i) => (
                  <li key={`${style.name}-${i}`}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-fg">{style.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-fg-muted">
                        {style.known}/{style.total || "?"}
                      </span>
                    </div>
                    <ProgressBar value={style.known} max={style.total || 1} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}

export function ChampionPanel({ character }: { character: Character }) {
  const disciplines = character.champion;
  const invested = disciplines.reduce(
    (sum, d) => sum + d.stars.reduce((s, star) => s + star.points, 0),
    0,
  );
  const slotted = disciplines.flatMap((d) => d.stars.filter((s) => s.slotted).map((s) => s.name));

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <SectionTitle className="mb-0">Champion Points</SectionTitle>
        <Link href="/encyclopedia/champion-points" className="text-xs text-accent hover:underline">
          Tree & planner →
        </Link>
      </div>
      {disciplines.length === 0 ? (
        <Card className="px-4 py-6 text-sm text-fg-muted">
          None captured for this character yet, or no points spent.
        </Card>
      ) : (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <span className="text-sm text-fg-muted">
              <span className="font-semibold tabular-nums text-fg">{invested.toLocaleString("en-US")}</span> points
              invested ·{" "}
              <span className="font-semibold tabular-nums text-fg">{slotted.length}</span> slotted
            </span>
            <div className="flex flex-wrap gap-1.5">
              {slotted.map((name) => (
                <Badge key={name} tone="accent">
                  <Star className="h-3 w-3" /> {name}
                </Badge>
              ))}
            </div>
          </Card>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {disciplines.map((disc, i) => {
              const discPoints = disc.stars.reduce((s, star) => s + star.points, 0);
              return (
                <Card key={i} className="p-4">
                  <div className="mb-2 flex items-baseline justify-between">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-fg">
                      <Star className="h-3.5 w-3.5 text-accent" /> {disc.name}
                    </span>
                    <span className="text-xs tabular-nums text-fg-muted">{discPoints}</span>
                  </div>
                  <ul className="space-y-1">
                    {disc.stars.map((star, j) => (
                      <li key={j} className="flex items-center justify-between gap-2 text-sm">
                        <span className={`min-w-0 truncate ${star.points > 0 ? "text-fg" : "text-fg-subtle"}`}>
                          {star.slotted && <span className="mr-1 text-accent">●</span>}
                          {star.name}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-fg-muted">{star.points}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
