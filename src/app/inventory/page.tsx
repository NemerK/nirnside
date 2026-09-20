import Link from "next/link";
import { Backpack, Ban, Hand } from "lucide-react";
import { getArchivedCharacters, getItemFacets, getItems, type ItemFilters } from "@/lib/db/queries";
import { setHref } from "@/lib/db/catalog-queries";
import { InventoryFilters } from "@/components/inventory-filters";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { locationLabel, qualityText } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const sp = await searchParams;
  const filters: ItemFilters = {
    search: str(sp.search),
    location: str(sp.location),
    quality: str(sp.quality),
    setName: str(sp.setName),
    trait: str(sp.trait),
    owner: str(sp.owner),
  };

  let items: ReturnType<typeof getItems> = [];
  let facets: ReturnType<typeof getItemFacets> = {
    locations: [],
    qualities: [],
    sets: [],
    traits: [],
    owners: [],
  };
  let archivedOwner = false;
  try {
    items = getItems(filters);
    facets = getItemFacets();
    if (filters.owner) {
      archivedOwner = getArchivedCharacters().some((c) => c.name === filters.owner);
    }
  } catch {
    // leave defaults
  }

  const totalStacks = items.length;
  const totalCount = items.reduce((sum, it) => sum + it.count, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Inventory"
        subtitle="Live bags only — worn gear, backpacks, bank, subscriber bank and craft bag. Deleted characters' last-known stacks live on their Archive page."
      />

      {archivedOwner && (
        <Card className="mb-4 px-4 py-3 text-sm text-fg-muted">
          Showing last-known bags for a deleted character. These stacks are not part of the live inventory.
        </Card>
      )}

      <InventoryFilters facets={facets} />

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
                    <th className="px-4 py-2.5 font-medium">Item</th>
                    <th className="px-3 py-2.5 font-medium text-right">Qty</th>
                    <th className="px-3 py-2.5 font-medium">Location</th>
                    <th className="px-3 py-2.5 font-medium">Owner</th>
                    <th className="px-3 py-2.5 font-medium">Set</th>
                    <th className="px-3 py-2.5 font-medium">Trait</th>
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
    </div>
  );
}

function str(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v || undefined;
}
