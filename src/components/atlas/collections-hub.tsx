import type { ReactNode } from "react";
import Link from "next/link";
import { Star } from "lucide-react";
import {
  collectionsSummaryLine,
  type CollectionTab,
  type CollectionsPresent,
} from "@/lib/collections/present";
import { AtlasEmpty, AtlasMeter, AtlasPage, AtlasPanel, AtlasStat } from "./ui";

const TABS: { id: CollectionTab; label: string; href: string }[] = [
  { id: "sets", label: "Sets", href: "/collections?tab=sets" },
  { id: "styles", label: "Styles", href: "/collections?tab=styles" },
  { id: "houses", label: "Houses", href: "/collections?tab=houses" },
];

function resolveTab(tab: string | undefined, fallback: CollectionTab): CollectionTab {
  if (tab === "sets" || tab === "styles" || tab === "houses") return tab;
  return fallback;
}

/**
 * Account → Collections hub. Classic still has stickerbook / styles / houses as
 * separate modules; Atlas folds them here. Optional panels can embed the full
 * Classic boards; otherwise we show summary + deep links.
 */
export function AtlasCollectionsHub({
  collections,
  tab,
  setsPanel,
  stylesPanel,
  housesPanel,
}: {
  collections: CollectionsPresent;
  tab?: string;
  setsPanel?: ReactNode;
  stylesPanel?: ReactNode;
  housesPanel?: ReactNode;
}) {
  const active = resolveTab(tab, collections.defaultTab);
  const stylesPct = collections.styles.total
    ? Math.round((collections.styles.unlocked / collections.styles.total) * 100)
    : 0;

  return (
    <AtlasPage
      grain="Account"
      title="Collections"
      subtitle={collectionsSummaryLine(collections)}
    >
      <div className="mb-6 flex flex-wrap gap-1 border-b border-border pb-3">
        {TABS.map((t) => {
          const on = t.id === active;
          return (
            <Link
              key={t.id}
              href={t.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                on ? "bg-accent-soft text-accent" : "text-fg-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      {active === "sets" ? (
        setsPanel ?? (
          <SetsSummary
            pct={collections.sets.pct}
            collected={collections.sets.collected}
            total={collections.sets.total}
            setCount={collections.sets.setCount}
          />
        )
      ) : null}

      {active === "styles" ? (
        stylesPanel ?? (
          <StylesSummary
            unlocked={collections.styles.unlocked}
            total={collections.styles.total}
            pct={stylesPct}
            categories={collections.styles.categories.length}
          />
        )
      ) : null}

      {active === "houses" ? (
        housesPanel ?? <HousesSummary collections={collections} />
      ) : null}
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
  categories: number;
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
        <AtlasStat label="Categories" value={categories} />
        <AtlasStat label="Still locked" value={Math.max(0, total - unlocked)} />
      </div>
      <AtlasPanel>
        <AtlasMeter label="Outfit styles" done={unlocked} total={total} />
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
