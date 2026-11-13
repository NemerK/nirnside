import Link from "next/link";
import type { Character } from "@/lib/snapshot/schema";
import { getCPStars } from "@/lib/db/catalog-queries";
import { GameIcon } from "./game-icon";

const SLOT_COUNT = 4;

const ORDER = ["warfare", "fitness", "craft"];
const EDGE: Record<string, string> = {
  warfare: "#d4654f",
  fitness: "#3dce7a",
  craft: "#d8b13a",
};

/**
 * Slotted stars first, then only the stars that actually have points.
 * Empty tree nodes stay off this pane.
 */
export function CharacterChampion({
  champion,
  championPoints,
}: {
  champion: Character["champion"];
  championPoints: number;
}) {
  const disciplines = [...champion].sort((a, b) => rank(a.name) - rank(b.name));
  const slotted = disciplines.flatMap((disc) => disc.stars.filter((star) => star.slotted));
  const icons = cpIcons();

  if (disciplines.length === 0) {
    return <p className="text-sm text-fg-muted">No champion stars captured for this character yet.</p>;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm text-fg-muted">
          <span className="font-semibold tabular-nums text-fg">{championPoints.toLocaleString("en-US")}</span> CP
          <span className="text-fg-subtle"> · {slotted.length} slotted</span>
        </p>
        <Link href="/encyclopedia/champion-points" className="text-xs text-accent hover:underline">
          Tree
        </Link>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {disciplines.map((disc) => {
          const onBar = disc.stars.filter((star) => star.slotted);
          const invested = disc.stars.filter((star) => star.points > 0 && !star.slotted);
          const spent = disc.stars.reduce((sum, star) => sum + star.points, 0);
          const edge = EDGE[disc.name.trim().toLowerCase()] ?? "var(--border-strong)";
          return (
            <section key={disc.name} className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2" style={{ borderTop: `2px solid ${edge}` }}>
                <h2 className="text-sm font-medium text-fg">{disc.name}</h2>
                <span className="text-xs tabular-nums text-fg-subtle">{spent.toLocaleString("en-US")}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 p-2">
                {Array.from({ length: SLOT_COUNT }, (_, index) => onBar[index] ?? null).map((star, index) => {
                  const icon = star ? icons.get(star.name.trim().toLowerCase()) : null;
                  return (
                    <div
                      key={star?.name ?? `empty-${index}`}
                      className="flex min-w-0 items-center gap-1.5 rounded border border-border bg-bg px-1.5 py-1"
                      title={star ? `${star.name} · ${star.points}` : "Empty slot"}
                    >
                      {icon ? (
                        <GameIcon name={star?.name ?? ""} icon={icon} size={22} bare />
                      ) : (
                        <span
                          className="h-5 w-5 shrink-0 rounded-full border-2"
                          style={{ borderColor: star ? edge : "var(--border)" }}
                          aria-hidden
                        />
                      )}
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] text-fg">{star?.name ?? "Empty"}</span>
                        {star ? <span className="block text-[10px] tabular-nums text-fg-subtle">{star.points}</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
              {onBar.length > SLOT_COUNT ? (
                <ul className="divide-y divide-border border-t border-border">
                  {onBar.slice(SLOT_COUNT).map((star) => (
                    <li key={star.name} className="flex items-center justify-between gap-2 px-3 py-1 text-xs">
                      <span className="min-w-0 truncate text-fg">{star.name}</span>
                      <span className="shrink-0 tabular-nums text-fg-muted">{star.points}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {invested.length > 0 ? (
                <ul className="border-t border-border">
                  {invested.map((star) => (
                    <li key={star.name} className="flex items-center justify-between gap-2 px-3 py-1 text-xs">
                      <span className="min-w-0 truncate text-fg-muted">{star.name}</span>
                      <span className="shrink-0 tabular-nums text-fg-subtle">{star.points}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function rank(name: string): number {
  const index = ORDER.indexOf(name.trim().toLowerCase());
  return index < 0 ? ORDER.length : index;
}

function cpIcons(): Map<string, string> {
  const map = new Map<string, string>();
  try {
    for (const row of getCPStars()) {
      const icon = row.entry.icon?.trim();
      if (icon) map.set(row.entry.name.trim().toLowerCase(), icon);
    }
  } catch {
    // The catalog is optional; the four slots still render by name.
  }
  return map;
}
