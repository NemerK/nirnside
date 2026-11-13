import Link from "next/link";
import { Star } from "lucide-react";
import { collectionsSummaryLine, type CollectionTab, type CollectionsPresent } from "@/lib/collections/present";
import { setHref } from "@/lib/db/catalog-queries";
import type { StickerbookSetView } from "@/lib/stickerbook/seen";
import { StickerbookGrid } from "@/components/stickerbook-grid";
import { OutfitStylesGrid } from "@/components/outfit-styles-grid";
import { GameIcon } from "@/components/game-icon";
import { AtlasEmpty, AtlasPage } from "./ui";
import { CollectionsTabs, type CollectionsTabId } from "./collections-tabs";

const TAB_ID: Record<CollectionTab, CollectionsTabId> = {
  sets: "stickerbook",
  styles: "styles",
  houses: "houses",
};

/**
 * Stickerbook, outfit styles, and houses, each on its own tab.
 */
export function AtlasCollectionsHub({
  collections,
  motifKeys = [],
}: {
  collections: CollectionsPresent;
  motifKeys?: string[];
}) {
  const { sets, styles, houses } = collections;
  const stickerCount = sets.total > 0 ? `${sets.collected}/${sets.total}` : "0";
  const stylesCount = styles.total > 0 ? `${styles.unlocked}/${styles.total}` : "0";
  const housesCount = String(houses.total);

  return (
    <AtlasPage title="Collections" subtitle={collectionsSummaryLine(collections)}>
      <CollectionsTabs
        initial={TAB_ID[collections.defaultTab]}
        counts={{ stickerbook: stickerCount, styles: stylesCount, houses: housesCount }}
        stickerbook={<StickerbookPane rows={sets.rows} total={sets.total} />}
        styles={<StylesPane collections={collections} motifKeys={motifKeys} />}
        houses={<HousesPane collections={collections} />}
      />
    </AtlasPage>
  );
}

function isStickerbookView(rows: CollectionsPresent["sets"]["rows"]): rows is StickerbookSetView[] {
  return rows.every((row) => "newCount" in row);
}

function StickerbookPane({ rows, total }: { rows: CollectionsPresent["sets"]["rows"]; total: number }) {
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
  return (
    <StickerbookGrid
      contained
      sets={rows.map((set) => ({ ...set, href: setHref({ name: set.name, setId: set.setId }) }))}
    />
  );
}

function StylesPane({ collections, motifKeys }: { collections: CollectionsPresent; motifKeys: string[] }) {
  if (collections.styles.total === 0) {
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
  return <OutfitStylesGrid contained presented={collections.styles} motifKeys={motifKeys} />;
}

function HousesPane({ collections }: { collections: CollectionsPresent }) {
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
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((house) => (
        <li key={house.collectibleId} className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
          <GameIcon name={house.name} icon={house.icon ?? undefined} size={40} />
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-sm font-medium text-fg">{house.name}</p>
              {house.primary ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-accent">
                  <Star className="h-3 w-3" /> Primary
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-xs text-fg-muted">{house.location || "Location unknown"}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
