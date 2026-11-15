"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Ban, Hand } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { SortHeader, useSort } from "@/components/sort-header";
import { locationLabel, qualityText } from "@/lib/format";
import { bagSubtypeLabel } from "@/lib/inventory/bag-filters";
import { sortRows } from "@/lib/ui/column-sort";
import type { Item } from "@/lib/snapshot/schema";

type InventoryColumn = "item" | "qty" | "location" | "owner" | "set" | "trait";

function columnValue(item: Item, key: InventoryColumn): string | number | null {
  switch (key) {
    case "item":
      return item.name;
    case "qty":
      return item.count;
    case "location":
      return locationLabel(item.location);
    case "owner":
      return item.ownerCharacter;
    case "set":
      return item.setName;
    case "trait":
      return item.trait;
  }
}

function setKey(item: Item): string {
  return `${item.setId ?? ""}|${item.setName ?? ""}`;
}

export function InventoryTable({ items, setHrefs }: { items: Item[]; setHrefs: Record<string, string> }) {
  const { sort, onSort } = useSort<InventoryColumn>();
  const rows = useMemo(() => sortRows(items, sort, columnValue), [items, sort]);

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium">
              <th className="px-4 py-2.5">
                <SortHeader label="Item" column="item" sort={sort} onSort={onSort} />
              </th>
              <th className="px-3 py-2.5">
                <SortHeader label="Qty" column="qty" sort={sort} onSort={onSort} align="right" />
              </th>
              <th className="px-3 py-2.5">
                <SortHeader label="Location" column="location" sort={sort} onSort={onSort} />
              </th>
              <th className="px-3 py-2.5">
                <SortHeader label="Owner" column="owner" sort={sort} onSort={onSort} />
              </th>
              <th className="px-3 py-2.5">
                <SortHeader label="Set" column="set" sort={sort} onSort={onSort} />
              </th>
              <th className="px-3 py-2.5">
                <SortHeader label="Trait" column="trait" sort={sort} onSort={onSort} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it, i) => (
              <tr
                key={`${it.itemId}-${it.location}-${it.ownerCharacter ?? ""}-${it.itemLink ?? it.name}-${i}`}
                className="border-b border-border/60 last:border-0 hover:bg-surface-2/50"
              >
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
                  {it.bagCategory ? (
                    <div className="text-xs text-fg-subtle">
                      {bagSubtypeLabel(it.bagCategory, it.bagSubtype, it.bagSubtypeLabel) ||
                        it.bagCategoryLabel ||
                        it.bagCategory}
                    </div>
                  ) : null}
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
                    <Link href={setHrefs[setKey(it)] ?? "#"} className="text-accent hover:underline">
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
  );
}
