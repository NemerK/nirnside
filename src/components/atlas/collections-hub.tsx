import type { ReactNode } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import { collectionsSummaryLine, type CollectionsPresent } from "@/lib/collections/present";
import type { PresentedOutfitCategory } from "@/lib/knowledge/present";
import { setHref } from "@/lib/db/catalog-queries";
import type { StickerbookSetView } from "@/lib/stickerbook/seen";
import { StickerbookGrid } from "@/components/stickerbook-grid";
import { AtlasEmpty, AtlasPage } from "./ui";

/**
 * Stickerbook, outfit styles, and houses as three sections on one page.
 * The stickerbook is the real collection (category tree and piece cards),
 * not a name-and-count summary.
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
      <div className="space-y-3">
        <section id="stickerbook">
          {setsPanel ?? (
            <StickerbookPanel
              pct={collections.sets.pct}
              collected={collections.sets.collected}
              total={collections.sets.total}
              setCount={collections.sets.setCount}
              rows={collections.sets.rows}
            />
          )}
        </section>
        <section id="styles">
          {stylesPanel ?? (
            <StylesPanel
              unlocked={collections.styles.unlocked}
              total={collections.styles.total}
              pct={stylesPct}
              categories={collections.styles.categories}
            />
          )}
        </section>
        <section id="houses">
          {housesPanel ?? <HousesPanel collections={collections} />}
        </section>
      </div>
    </AtlasPage>
  );
}

function Panel({
  title,
  meta,
  href,
  linkLabel,
  children,
}: {
  title: string;
  meta: string;
  href: string;
  linkLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface">
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-3 py-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-medium text-fg">{title}</h2>
          <span className="text-xs tabular-nums text-fg-muted">{meta}</span>
        </div>
        <Link href={href} className="text-xs text-accent hover:underline">
          {linkLabel}
        </Link>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function isStickerbookView(rows: CollectionsPresent["sets"]["rows"]): rows is StickerbookSetView[] {
  return rows.every((row) => "newCount" in row);
}

function StickerbookPanel({
  pct,
  collected,
  total,
  setCount,
  rows,
}: {
  pct: number;
  collected: number;
  total: number;
  setCount: number;
  rows: CollectionsPresent["sets"]["rows"];
}) {
  if (total === 0 || !isStickerbookView(rows)) {
    return (
      <AtlasEmpty title="Stickerbook is empty">
        Log out with the Snapshot addon to capture set pieces, or open the{" "}
        <Link href="/stickerbook" className="text-accent hover:underline">
          stickerbook
        </Link>
        .
      </AtlasEmpty>
    );
  }
  const complete = rows.filter((set) => set.total > 0 && set.collected === set.total).length;
  return (
    <Panel
      title="Stickerbook"
      meta={`${pct}% · ${collected}/${total} pieces · ${complete}/${setCount} sets`}
      href="/stickerbook"
      linkLabel="Full page"
    >
      <StickerbookGrid
        contained
        sets={rows.map((set) => ({ ...set, href: setHref({ name: set.name, setId: set.setId }) }))}
      />
    </Panel>
  );
}

function StylesPanel({
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
        Outfit styles arrive after a logout with a current Snapshot addon. Browse the{" "}
        <Link href="/styles" className="text-accent hover:underline">
          styles page
        </Link>
        .
      </AtlasEmpty>
    );
  }
  return (
    <Panel title="Styles" meta={`${pct}% · ${unlocked}/${total}`} href="/styles" linkLabel="Outfit styles">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <div key={category.name} className="rounded-md border border-border bg-bg px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm text-fg">{category.name}</span>
              <span className="shrink-0 text-xs tabular-nums text-fg-muted">
                {category.unlocked}/{category.total}
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div
                className="h-full rounded-full bg-ok"
                style={{ width: `${category.total > 0 ? Math.round((category.unlocked / category.total) * 100) : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function HousesPanel({ collections }: { collections: CollectionsPresent }) {
  const { rows, total } = collections.houses;
  if (total === 0) {
    return (
      <AtlasEmpty title="No houses unlocked">
        Ownership only. House banks are never collected. See{" "}
        <Link href="/houses" className="text-accent hover:underline">
          houses
        </Link>{" "}
        after the next logout.
      </AtlasEmpty>
    );
  }
  return (
    <Panel title="Houses" meta={`${total} owned`} href="/houses" linkLabel="All houses">
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((house) => (
          <li key={house.collectibleId} className="rounded-md border border-border bg-bg px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-medium text-fg">{house.name}</p>
              {house.primary ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-accent">
                  <Star className="h-3 w-3" /> Primary
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-fg-muted">{house.location || "Location unknown"}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
