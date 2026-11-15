import Link from "next/link";
import type { Character } from "@/lib/snapshot/schema";
import { getCPStars } from "@/lib/db/catalog-queries";
import {
  alignChampionDisciplines,
  groupChampionStars,
  type ChampionKind,
  type ChampionStarView,
} from "@/lib/characters/champion";
import { GameIcon } from "@/components/game-icon";

/** Craft, then Warfare, then Fitness — the same left-to-right read as the constellation bar. */
const ORDER = ["craft", "warfare", "fitness"];
const COLOR: Record<string, string> = {
  craft: "#3dce7a",
  warfare: "#4c9dff",
  fitness: "#e15b4a",
};

/**
 * Each discipline shows the four equipped slottables, then the unlocked
 * slottables that are off the bar, then the passives.
 */
export function CharacterChampion({
  champion,
  championPoints,
}: {
  champion: Character["champion"];
  championPoints: number;
}) {
  const catalog = cpCatalog();
  const rows = [...alignChampionDisciplines(champion, catalog.categories)]
    .sort((a, b) => rank(a.name) - rank(b.name))
    .map((disc) => ({
      disc,
      groups: groupChampionStars(disc.stars, catalog.kinds),
      spent: disc.stars.reduce((sum, star) => sum + star.points, 0),
    }));
  const slotted = rows.reduce(
    (sum, row) => sum + row.groups.equipped.filter(Boolean).length + row.groups.overflow.length,
    0,
  );

  if (rows.length === 0) {
    return <p className="text-sm text-fg-muted">No champion stars captured for this character yet.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-fg-muted">
          <span className="font-semibold tabular-nums text-fg">{championPoints.toLocaleString("en-US")}</span> CP
          <span className="text-fg-subtle"> · {slotted} slotted</span>
        </p>
        <Link href="/encyclopedia/champion-points" className="text-xs text-accent hover:underline">
          Tree
        </Link>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {rows.map(({ disc, groups, spent }) => {
          const key = disc.name.trim().toLowerCase();
          const color = COLOR[key] ?? "var(--border-strong)";
          return (
            <section key={disc.name} className="overflow-hidden rounded-lg border border-border bg-surface">
              <div
                className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2"
                style={{ borderTop: `2px solid ${color}` }}
              >
                <h2 className="text-sm font-medium text-fg">{disc.name}</h2>
                <span className="text-xs tabular-nums text-fg-subtle">{spent.toLocaleString("en-US")}</span>
              </div>
              <div className="px-3 pt-2 text-[10px] font-medium uppercase tracking-wide text-fg-subtle">Equipped</div>
              <div className="flex justify-center gap-2 px-2 py-3">
                {groups.equipped.map((star, index) => (
                  <div
                    key={star?.name ?? `empty-${index}`}
                    className="flex w-16 flex-col items-center"
                    title={star ? `${star.name} · ${star.points}` : "Empty slot"}
                  >
                    <SlotMark star={star} color={color} icon={star ? iconFor(star, catalog.icons) : null} />
                    <span className="mt-1 line-clamp-2 text-center text-[10px] leading-tight text-fg">
                      {star?.name ?? "Open"}
                    </span>
                  </div>
                ))}
              </div>
              {groups.barUnknown ? (
                <p className="px-3 pb-2 text-[11px] leading-snug text-fg-subtle">
                  The bar was not in this snapshot. Log out once with this update and these four slots fill in.
                </p>
              ) : null}
              {groups.overflow.length > 0 ? (
                <ul className="border-t border-border px-3 py-1 text-xs text-fg-muted">
                  {groups.overflow.map((star) => (
                    <li key={star.name}>
                      {star.name} · {star.points}
                    </li>
                  ))}
                </ul>
              ) : null}
              <StarList
                title="Unlocked"
                stars={groups.unlocked}
                icons={catalog.icons}
                empty="None off the bar."
              />
              <StarList title="Passives" stars={groups.passives} icons={catalog.icons} empty="None." />
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SlotMark({ star, color, icon }: { star: ChampionStarView | null; color: string; icon: string | null }) {
  if (star && icon) {
    return <GameIcon name={star.name} icon={icon} size={28} bare />;
  }
  return (
    <span
      className="h-6 w-6 rounded-full border-2"
      style={{
        borderColor: color,
        background: star ? color : "transparent",
        boxShadow: star ? "inset 0 0 0 3px var(--surface)" : undefined,
      }}
      aria-hidden
    />
  );
}

function StarList({
  title,
  stars,
  icons,
  empty,
}: {
  title: string;
  stars: ChampionStarView[];
  icons: Map<string, string>;
  empty: string;
}) {
  return (
    <div className="border-t border-border">
      <div className="px-3 pt-2 text-[10px] font-medium uppercase tracking-wide text-fg-subtle">{title}</div>
      {stars.length === 0 ? (
        <p className="px-3 py-1.5 text-xs text-fg-subtle">{empty}</p>
      ) : (
        <ul>
          {stars.map((star) => {
            const icon = iconFor(star, icons);
            return (
              <li key={star.name} className="flex items-center justify-between gap-2 px-3 py-1 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  {icon ? <GameIcon name={star.name} icon={icon} size={16} bare /> : null}
                  <span className="min-w-0 truncate text-fg-muted">{star.name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-fg-subtle">{star.points}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function iconFor(star: ChampionStarView, icons: Map<string, string>): string | null {
  return star.icon || icons.get(star.name.trim().toLowerCase()) || null;
}

function rank(name: string): number {
  const index = ORDER.indexOf(name.trim().toLowerCase());
  return index < 0 ? ORDER.length : index;
}

function cpCatalog(): {
  kinds: Map<string, ChampionKind>;
  icons: Map<string, string>;
  categories: Map<string, string>;
} {
  const kinds = new Map<string, ChampionKind>();
  const icons = new Map<string, string>();
  const categories = new Map<string, string>();
  try {
    for (const row of getCPStars()) {
      const name = row.entry.name.trim().toLowerCase();
      kinds.set(name, row.entry.type);
      categories.set(name, row.entry.category.trim().toLowerCase());
      if (row.entry.icon) icons.set(name, row.entry.icon);
    }
  } catch {
    // Without the catalog, stars with no kind of their own stay under Unlocked.
  }
  return { kinds, icons, categories };
}
