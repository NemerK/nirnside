import type { ReactNode } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import {
  collectionsSummaryLine,
  type CollectionsPresent,
} from "@/lib/collections/present";
import type { PresentedOutfitCategory } from "@/lib/knowledge/present";
import { AtlasEmpty, AtlasMeter, AtlasPage, AtlasPanel, AtlasStat } from "./ui";

/**
 * Account → Collections. Sets, outfit styles, and houses share one page.
 * Classic still keeps each system on its own route; those stay linked from here.
 */
export function AtlasCollectionsHub({
  collections,
  setsPanel,
  stylesPanel,
  housesPanel,
}: {
  collections: CollectionsPresent;
  setsPanel?: ReactNode;
  stylesPanel?: ReactNode;
  housesPanel?: ReactNode;
}) {
  const stylesPct = collections.styles.total
    ? Math.round((collections.styles.unlocked / collections.styles.total) * 100)
    : 0;

  return (
    <AtlasPage title="Collections" subtitle={collectionsSummaryLine(collections)}>
      <div className="grid gap-4 lg:grid-cols-2">
        <section id="sets">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Sets</h2>
          {setsPanel ?? (
            <SetsSummary
              pct={collections.sets.pct}
              collected={collections.sets.collected}
              total={collections.sets.total}
              setCount={collections.sets.setCount}
            />
          )}
        </section>
        <section id="styles">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Styles</h2>
          {stylesPanel ?? (
            <StylesSummary
              unlocked={collections.styles.unlocked}
              total={collections.styles.total}
              pct={stylesPct}
              categories={collections.styles.categories}
            />
          )}
        </section>
        <section id="houses" className="lg:col-span-2">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Houses</h2>
          {housesPanel ?? <HousesSummary collections={collections} />}
        </section>
      </div>
    </AtlasPage>
  );
}

function SetsSummary({
  pct,
  collected,
  total,
  setCount,
}: {
  pct: number;
  collected: number;
  total: number;
  setCount: number;
}) {
  if (total === 0) {
    return (
      <AtlasEmpty title="Stickerbook is empty">
        Log out with the Snapshot addon to capture set pieces, or open the{" "}
        <Link href="/stickerbook" className="text-accent hover:underline">
          classic stickerbook
        </Link>
        .
      </AtlasEmpty>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <AtlasStat label="Overall" value={`${pct}%`} hint={`${collected}/${total} pieces`} />
        <AtlasStat label="Sets tracked" value={setCount} />
        <AtlasStat label="Still missing" value={Math.max(0, total - collected)} />
      </div>
      <AtlasPanel>
        <AtlasMeter label="Set reconstruction" done={collected} total={total} />
        <p className="mt-4 text-sm text-fg-muted">
          Deep filters and per-piece hover live on the{" "}
          <Link href="/stickerbook" className="text-accent hover:underline">
            stickerbook
          </Link>
          .
        </p>
      </AtlasPanel>
    </div>
  );
}

function StylesSummary({
  unlocked,
  total,
  pct,
  categories,
}: {
  unlocked: number;
  total: number;
  pct: number;
  categories: PresentedOutfitCategory[];
}) {
  if (total === 0) {
    return (
      <AtlasEmpty title="No outfit styles listed">
        Collections → Outfit Styles arrive after a logout with a current Snapshot addon. Browse the{" "}
        <Link href="/styles" className="text-accent hover:underline">
          styles page
        </Link>{" "}
        for the full tree.
      </AtlasEmpty>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <AtlasStat label="Unlocked" value={`${pct}%`} hint={`${unlocked}/${total} styles`} />
        <AtlasStat label="Categories" value={categories.length} />
        <AtlasStat label="Still locked" value={Math.max(0, total - unlocked)} />
      </div>
      <AtlasPanel>
        <AtlasMeter label="Outfit styles" done={unlocked} total={total} />
        {categories.length > 0 ? (
          <ul className="mt-3 divide-y divide-border">
            {categories.map((category) => (
              <li key={category.name} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                <span className="min-w-0 truncate text-fg">{category.name}</span>
                <span className="shrink-0 tabular-nums text-fg-muted">
                  {category.unlocked}/{category.total}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-4 text-sm text-fg-muted">
          Open{" "}
          <Link href="/styles" className="text-accent hover:underline">
            Outfit Styles
          </Link>{" "}
          for the full Collections tree and motif cross-links.
        </p>
      </AtlasPanel>
    </div>
  );
}

function HousesSummary({ collections }: { collections: CollectionsPresent }) {
  const { rows, primary, total } = collections.houses;
  if (total === 0) {
    return (
      <AtlasEmpty title="No houses unlocked">
        Ownership only — house banks are never collected. See the{" "}
        <Link href="/houses" className="text-accent hover:underline">
          houses list
        </Link>{" "}
        after the next logout.
      </AtlasEmpty>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <AtlasStat label="Owned" value={total} />
        <AtlasStat
          label="Primary"
          value={primary?.name ?? "—"}
          hint={primary?.location ?? undefined}
        />
      </div>
      <AtlasPanel>
        <ul className="divide-y divide-border">
          {rows.map((h) => (
            <li key={h.collectibleId} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{h.name}</p>
                <p className="text-sm text-fg-muted">{h.location || "Location unknown"}</p>
              </div>
              {h.primary ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-accent">
                  <Star className="h-3 w-3" /> Primary
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-fg-muted">
          Classic layout with icons:{" "}
          <Link href="/houses" className="text-accent hover:underline">
            /houses
          </Link>
          .
        </p>
      </AtlasPanel>
    </div>
  );
}
