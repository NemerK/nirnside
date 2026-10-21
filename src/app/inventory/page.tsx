import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Backpack, Ban, Coins, Hand } from "lucide-react";
import {
  getAccount,
  getArchivedCharacters,
  getCharacters,
  getItemFacets,
  getItems,
  isItemSortKey,
  type ItemFilters,
  type ItemSortKey,
} from "@/lib/db/queries";
import { setHref } from "@/lib/db/catalog-queries";
import { accountAlliancePoints, goldBreakdown } from "@/lib/snapshot/roster";
import { InventoryFilters } from "@/components/inventory-filters";
import { InventoryTabs } from "@/components/inventory-tabs";
import { CurrencyTable } from "@/components/currency-table";
import { Badge, Card, EmptyState, PageFrame, PageHeader, PageScroll, StickyMenu } from "@/components/ui";
import { formatGold, formatNumber, locationLabel, qualityText } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const sp = await searchParams;
  const view = str(sp.view) === "currency" ? "currency" : "items";
  const sortParam = str(sp.sort);
  const sort: ItemSortKey | undefined = isItemSortKey(sortParam) ? sortParam : undefined;
  const dir: "asc" | "desc" = str(sp.dir) === "desc" ? "desc" : "asc";
  const filters: ItemFilters = {
    search: str(sp.search),
    location: str(sp.location),
    quality: str(sp.quality),
    setName: str(sp.setName),
    trait: str(sp.trait),
    owner: str(sp.owner),
    itemType: str(sp.itemType),
    sort,
    dir,
  };
  // Current filters, carried into every sort link so sorting keeps the view.
  const baseParams: Record<string, string | undefined> = {
    search: filters.search,
    location: filters.location,
    quality: filters.quality,
    setName: filters.setName,
    trait: filters.trait,
    owner: filters.owner,
    itemType: filters.itemType,
  };

  let items: ReturnType<typeof getItems> = [];
  let facets: ReturnType<typeof getItemFacets> = {
    locations: [],
    qualities: [],
    sets: [],
    traits: [],
    owners: [],
    types: [],
  };
  let archivedOwner = false;
  let ownerWallet: {
    name: string;
    gold: number;
    telVar: number;
    alliancePoints: number;
    lastSeen: number | null;
  } | null = null;
  try {
    items = getItems(filters);
    facets = getItemFacets();
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

  return (
    <PageFrame>
      <PageHeader
        title="Inventory"
        subtitle={
          view === "currency"
            ? "Gold, Tel Var, and Alliance Points per character, plus account-wide currencies from the last snapshot."
            : "Live bags only — worn gear, backpacks, bank, subscriber bank and craft bag. Deleted characters' last-known stacks live on their Archive page."
        }
      />

      <StickyMenu className="space-y-3">
        <InventoryTabs current={view} />
        {view === "items" ? <InventoryFilters facets={facets} /> : null}
      </StickyMenu>

      <PageScroll>
      {view === "currency" ? <CurrencyView /> : (
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
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-fg-subtle">
                        <SortHeader col="item" label="Item" base={baseParams} current={sort} dir={dir} padClass="px-4" />
                        <SortHeader col="qty" label="Qty" base={baseParams} current={sort} dir={dir} />
                        <SortHeader col="type" label="Type" base={baseParams} current={sort} dir={dir} />
                        <SortHeader col="location" label="Location" base={baseParams} current={sort} dir={dir} />
                        <SortHeader col="owner" label="Owner" base={baseParams} current={sort} dir={dir} />
                        <SortHeader col="set" label="Set" base={baseParams} current={sort} dir={dir} />
                        <SortHeader col="trait" label="Trait" base={baseParams} current={sort} dir={dir} />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <tr key={i} className="border-b border-border/60 last:border-0 hover:bg-surface-2/50">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium ${qualityText(it.quality)}`}>{it.name}</span>
                              {it.stolen && (
                                <Badge tone="danger">
                                  <Hand className="h-3 w-3" /> Stolen
                                </Badge>
                              )}
                              {!it.obtainable && (
                                <Badge tone="muted">
                                  <Ban className="h-3 w-3" /> Unobtainable
                                </Badge>
                              )}
                            </div>
                            {it.level && <div className="text-xs text-fg-subtle">CP{it.level}</div>}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-fg-muted">
                            {it.count.toLocaleString("en-US")}
                          </td>
                          <td className="px-3 py-2.5 text-fg-muted">{it.itemType ?? "—"}</td>
                          <td className="px-3 py-2.5">
                            <span className="rounded-md border border-border px-1.5 py-0.5 text-xs text-fg-muted">
                              {locationLabel(it.location)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-fg-muted">{it.ownerCharacter ?? "—"}</td>
                          <td className="px-3 py-2.5 text-fg-muted">
                            {it.setName ? (
                              <Link href={setHref({ name: it.setName })} className="text-accent hover:underline">
                                {it.setName}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-fg-muted">{it.trait ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}
      </PageScroll>
    </PageFrame>
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

function SortHeader({
  col,
  label,
  current,
  dir,
  base,
  padClass = "px-3",
}: {
  col: ItemSortKey;
  label: string;
  current: ItemSortKey | undefined;
  dir: "asc" | "desc";
  base: Record<string, string | undefined>;
  padClass?: string;
}) {
  const active = current === col;
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) if (v) params.set(k, v);
  params.set("sort", col);
  params.set("dir", nextDir);
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th className={`${padClass} py-2.5 font-medium`}>
      <Link
        href={`/inventory?${params.toString()}`}
        scroll={false}
        aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
        className={`group inline-flex items-center gap-1 ${active ? "text-fg" : "hover:text-fg"}`}
      >
        {label}
        <Icon
          className={`h-3 w-3 ${active ? "text-accent" : "text-fg-subtle/40 group-hover:text-fg-subtle"}`}
        />
      </Link>
    </th>
  );
}

function str(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}
