import Link from "next/link";
import type { Character } from "@/lib/snapshot/schema";
import { getCPStars } from "@/lib/db/catalog-queries";

const SLOT_COUNT = 4;

/** Craft, then Warfare, then Fitness — the same left-to-right read as the constellation bar. */
const ORDER = ["craft", "warfare", "fitness"];
const COLOR: Record<string, string> = {
  craft: "#3dce7a",
  warfare: "#4c9dff",
  fitness: "#e15b4a",
};

type StarKind = "slottable" | "passive" | "cluster";

/**
 * Four circles per tree: filled when that star is slotted, hollow when the
 * slot is open. Invested slottables that are not on the bar come next, then
 * the passives.
 */
export function CharacterChampion({
  champion,
  championPoints,
}: {
  champion: Character["champion"];
  championPoints: number;
}) {
  const disciplines = [...champion].sort((a, b) => rank(a.name) - rank(b.name));
  const kinds = cpKinds();
  const slotted = disciplines.flatMap((disc) => disc.stars.filter((star) => star.slotted));

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
          const key = disc.name.trim().toLowerCase();
          const color = COLOR[key] ?? "var(--border-strong)";
          const onBar = disc.stars.filter((star) => star.slotted);
          const invested = disc.stars.filter((star) => star.points > 0 && !star.slotted);
          const unequipped = invested.filter((star) => kindOf(kinds, star.name) !== "passive");
          const passives = invested.filter((star) => kindOf(kinds, star.name) === "passive");
          const spent = disc.stars.reduce((sum, star) => sum + star.points, 0);
          return (
            <section key={disc.name} className="overflow-hidden rounded-lg border border-border bg-surface">
              <div className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2" style={{ borderTop: `2px solid ${color}` }}>
                <h2 className="text-sm font-medium text-fg">{disc.name}</h2>
                <span className="text-xs tabular-nums text-fg-subtle">{spent.toLocaleString("en-US")}</span>
              </div>
              <div className="flex justify-center gap-2 px-2 py-3">
                {Array.from({ length: SLOT_COUNT }, (_, index) => onBar[index] ?? null).map((star, index) => (
                  <div key={star?.name ?? `empty-${index}`} className="flex w-16 flex-col items-center" title={star ? `${star.name} · ${star.points}` : "Empty slot"}>
                    <span
                      className="h-6 w-6 rounded-full border-2"
                      style={{
                        borderColor: color,
                        background: star ? color : "transparent",
                        boxShadow: star ? "inset 0 0 0 3px var(--surface)" : undefined,
                      }}
                      aria-hidden
                    />
                    <span className="mt-1 line-clamp-2 text-center text-[10px] leading-tight text-fg">
                      {star?.name ?? "Open"}
                    </span>
                  </div>
                ))}
              </div>
              {onBar.length > SLOT_COUNT ? (
                <ul className="border-t border-border px-3 py-1 text-xs text-fg-muted">
                  {onBar.slice(SLOT_COUNT).map((star) => (
                    <li key={star.name}>
                      {star.name} · {star.points}
                    </li>
                  ))}
                </ul>
              ) : null}
              {unequipped.length > 0 ? (
                <StarList title="Not slotted" stars={unequipped} />
              ) : null}
              {passives.length > 0 ? <StarList title="Passives" stars={passives} /> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StarList({
  title,
  stars,
}: {
  title: string;
  stars: { name: string; points: number }[];
}) {
  return (
    <div className="border-t border-border">
      <div className="px-3 pt-2 text-[10px] font-medium uppercase tracking-wide text-fg-subtle">{title}</div>
      <ul>
        {stars.map((star) => (
          <li key={star.name} className="flex items-center justify-between gap-2 px-3 py-1 text-xs">
            <span className="min-w-0 truncate text-fg-muted">{star.name}</span>
            <span className="shrink-0 tabular-nums text-fg-subtle">{star.points}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function rank(name: string): number {
  const index = ORDER.indexOf(name.trim().toLowerCase());
  return index < 0 ? ORDER.length : index;
}

function kindOf(kinds: Map<string, StarKind>, name: string): StarKind | null {
  return kinds.get(name.trim().toLowerCase()) ?? null;
}

function cpKinds(): Map<string, StarKind> {
  const map = new Map<string, StarKind>();
  try {
    for (const row of getCPStars()) {
      map.set(row.entry.name.trim().toLowerCase(), row.entry.type);
    }
  } catch {
    // Without the catalog, invested stars still list under "Not slotted".
  }
  return map;
}
