import { Backpack, Coins } from "lucide-react";
import { getAccount, getArchivedCharacters, getCharacters, getItemFacets, getItems, type ItemFilters } from "@/lib/db/queries";
import { setHref } from "@/lib/db/catalog-queries";
import { loadSetHover } from "@/lib/catalog/hover-sets";
import { withResolvedSet, type SetBrief } from "@/lib/catalog/set-brief";
import { hrefForMythicOrSet } from "@/lib/collections/mythic-match";
import { accountAlliancePoints, goldBreakdown } from "@/lib/snapshot/roster";
import { InventoryFilters } from "@/components/inventory-filters";
import { InventoryTable } from "@/components/inventory-table";
import { CurrencyTable } from "@/components/currency-table";
import { AtlasInventoryChrome } from "@/components/atlas/inventory";
import { Card, EmptyState, PageScroll, StickyMenu } from "@/components/ui";
import { formatGold, formatNumber } from "@/lib/format";
import { tallyBagFilters } from "@/lib/inventory/bag-filters";
import { InventoryCategories } from "@/components/inventory-categories";
import { SetCatalogProvider } from "@/components/set-hover";

export const dynamic = "force-dynamic";

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const view = str(sp.view) === "currency" ? "currency" : "items";
  const filters: ItemFilters = {
    search: str(sp.search),
    location: str(sp.location),
    quality: str(sp.quality),
    setName: str(sp.setName),
    trait: str(sp.trait),
    owner: str(sp.owner),
  };
  const bag = str(sp.bag);
  const sub = str(sp.sub);

  let items: ReturnType<typeof getItems> = [];
  let mythics: NonNullable<ReturnType<typeof getAccount>>["mythics"] = [];
  let setBriefs: SetBrief[] = [];
  let bagCounts: ReturnType<typeof tallyBagFilters>["counts"] = {};
  let bagLabels: Record<string, string> = {};
  let untagged = 0;
  let facets: ReturnType<typeof getItemFacets> = {
    locations: [],
    qualities: [],
    sets: [],
    traits: [],
    owners: [],
  };
  let archivedOwner = false;
  let ownerWallet: {
    name: string;
    gold: number;
    telVar: number;
    alliancePoints: number;
    lastSeen: number | null;
  } | null = null;
  const hover = loadSetHover();
  setBriefs = hover.briefs;
  try {
    const setFilter = filters.setName;
    items = getItems({ ...filters, setName: undefined }).map((item) => withResolvedSet(item, hover.known));
    if (setFilter) items = items.filter((item) => item.setName === setFilter);
    mythics = getAccount()?.mythics ?? [];
    untagged = items.filter((it) => !it.bagCategory).length;
    const tallied = tallyBagFilters(items);
    bagCounts = tallied.counts;
    bagLabels = tallied.labels;
    if (bag) items = items.filter((it) => it.bagCategory === bag);
    if (sub) items = items.filter((it) => it.bagSubtype === sub);
    facets = getItemFacets();
    const setNames = new Set<string>();
    for (const item of getItems({})) {
      const name = withResolvedSet(item, hover.known).setName?.trim();
      if (name) setNames.add(name);
    }
    facets = { ...facets, sets: [...setNames].sort((a, b) => a.localeCompare(b, "en")) };
    if (filters.owner) {
      const archived = getArchivedCharacters();
      archivedOwner = archived.some((c) => c.name === filters.owner);
      const owner =
        getCharacters().find((c) => c.name === filters.owner) ?? archived.find((c) => c.name === filters.owner);
      if (owner) {
        ownerWallet = {
          name: owner.name,
          gold: owner.gold ?? 0,
          telVar: owner.telVar ?? 0,
          alliancePoints: owner.alliancePoints ?? 0,
          lastSeen: owner.lastSeen,
        };
      }
    }
  } catch {
    // leave defaults
  }

  const totalStacks = items.length;
  const totalCount = items.reduce((sum, it) => sum + it.count, 0);

  const itemList = (
    <ItemsBody
      items={items}
      mythics={mythics}
      setBriefs={setBriefs}
      ownerWallet={ownerWallet}
      archivedOwner={archivedOwner}
      totalStacks={totalStacks}
      totalCount={totalCount}
    />
  );

  const atlasBody = (
    <>
      {view === "items" ? (
        <StickyMenu className="mb-3 space-y-3">
          <InventoryCategories counts={bagCounts} labels={bagLabels} untagged={untagged} />
          <InventoryFilters facets={facets} />
        </StickyMenu>
      ) : null}
      {view === "currency" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <CurrencyView />
        </div>
      ) : (
        <PageScroll>{itemList}</PageScroll>
      )}
    </>
  );

  return (
    <AtlasInventoryChrome view={view}>{atlasBody}</AtlasInventoryChrome>
  );
}

function setHrefsFor(
  items: ReturnType<typeof getItems>,
  mythics: NonNullable<ReturnType<typeof getAccount>>["mythics"],
): Record<string, string> {
  const hrefs: Record<string, string> = {};
  for (const item of items) {
    if (!item.setName) continue;
    const key = `${item.setId ?? ""}|${item.setName}`;
    if (hrefs[key]) continue;
    hrefs[key] = hrefForMythicOrSet(
      mythics,
      { name: item.setName, setId: item.setId },
      setHref({ name: item.setName, setId: item.setId }),
    );
  }
  return hrefs;
}

function ItemsBody({
  items,
  mythics,
  setBriefs,
  ownerWallet,
  archivedOwner,
  totalStacks,
  totalCount,
}: {
  items: ReturnType<typeof getItems>;
  mythics: NonNullable<ReturnType<typeof getAccount>>["mythics"];
  setBriefs: SetBrief[];
  ownerWallet: {
    name: string;
    gold: number;
    telVar: number;
    alliancePoints: number;
    lastSeen: number | null;
  } | null;
  archivedOwner: boolean;
  totalStacks: number;
  totalCount: number;
}) {
  return (
    <SetCatalogProvider sets={setBriefs}>
    <>
      {ownerWallet && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="text-fg">{ownerWallet.name}&apos;s wallet</span>
          <span className="flex flex-wrap gap-4 tabular-nums">
            <span className="text-yellow-200">
              {ownerWallet.lastSeen ? formatGold(ownerWallet.gold) : "—"}
              <span className="ml-1 text-xs uppercase tracking-wider text-fg-subtle">Gold</span>
            </span>
            <span className="text-sky-300">
              {ownerWallet.lastSeen ? formatNumber(ownerWallet.telVar) : "—"}
              <span className="ml-1 text-xs uppercase tracking-wider text-fg-subtle">Tel Var</span>
            </span>
            <span className="text-emerald-400">
              {ownerWallet.lastSeen ? formatNumber(ownerWallet.alliancePoints) : "—"}
              <span className="ml-1 text-xs uppercase tracking-wider text-fg-subtle">AP</span>
            </span>
          </span>
        </Card>
      )}
      {archivedOwner && (
        <Card className="mb-4 px-4 py-3 text-sm text-fg-muted">
          Showing last-known bags for a deleted character. These stacks are not part of the live inventory.
        </Card>
      )}

      {items.length === 0 ? (
        <EmptyState title="No items match" icon={<Backpack className="h-8 w-8" />}>
          Try clearing filters, or import a snapshot (<code className="rounded bg-surface-2 px-1">npm run seed</code> for
          sample data).
        </EmptyState>
      ) : (
        <>
          <div className="mb-3 text-sm text-fg-muted">
            {totalStacks.toLocaleString("en-US")} stacks · {totalCount.toLocaleString("en-US")} items
          </div>
          <InventoryTable items={items} setHrefs={setHrefsFor(items, mythics)} />
        </>
      )}
    </>
    </SetCatalogProvider>
  );
}

function CurrencyView() {
  let characters: ReturnType<typeof getCharacters> = [];
  let bankGold = 0;
  let gold = goldBreakdown({ characters: [] });
  let currencies: Record<string, number> = {};
  try {
    characters = getCharacters();
    const account = getAccount();
    bankGold = account?.currencies?.bankGold ?? 0;
    currencies = {
      ...(account?.currencies ?? {}),
      alliancePoints: accountAlliancePoints({
        characters,
        legacyAlliancePoints: account?.currencies?.alliancePoints,
      }),
    };
    gold = goldBreakdown({
      characters,
      bankGold,
      legacyGold: account?.gold,
    });
  } catch {
    characters = [];
  }

  if (characters.length === 0 && gold.total === 0) {
    return (
      <EmptyState title="No currencies yet" icon={<Coins className="h-8 w-8" />}>
        Import a snapshot to see gold, Tel Var, and account currencies.
      </EmptyState>
    );
  }

  return <CurrencyTable characters={characters} bankGold={bankGold} gold={gold} currencies={currencies} />;
}

function str(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}
