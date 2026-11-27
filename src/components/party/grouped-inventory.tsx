"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Hand } from "lucide-react";
import { SetHover } from "@/components/set-hover";
import { SortHeader, useSort } from "@/components/sort-header";
import { locationLabel, qualityText } from "@/lib/format";
import { bagSubtypeLabel } from "@/lib/game/item-category";
import { sortRows } from "@/lib/ui/column-sort";
import type { ItemGroup } from "@/lib/party/inventory";

type Column = "item" | "qty" | "set" | "trait";

function value(g: ItemGroup, key: Column): string | number | null {
  switch (key) {
    case "item":
      return g.item.name;
    case "qty":
      return g.total;
    case "set":
      return g.item.setName;
    case "trait":
      return g.item.trait;
  }
}

const SHOW_HOLDERS = 4;

/**
 * Inventory as one row per kind of item, with who holds how many: answers
 * "where is my X?" without reading the same name twenty times.
 */
export function GroupedInventory({
  groups,
  setHrefs,
  characterIds,
}: {
  groups: ItemGroup[];
  setHrefs: Record<string, string>;
  characterIds: Record<string, string>;
}) {
  const { sort, onSort } = useSort<Column>();
  const rows = useMemo(() => sortRows(groups, sort, value), [groups, sort]);

  return (
    <div className="party-module overflow-hidden p-0">
      <div className="max-h-[calc(100dvh-15rem)] overflow-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-border text-left text-[12px]">
              <th className="px-4 py-2 font-normal">
                <SortHeader label="Item" column="item" sort={sort} onSort={onSort} />
              </th>
              <th className="w-20 px-3 py-2 font-normal">
                <SortHeader label="Total" column="qty" sort={sort} onSort={onSort} align="right" />
              </th>
              <th className="px-3 py-2 font-normal text-fg-subtle">Held by</th>
              <th className="px-3 py-2 font-normal">
                <SortHeader label="Set" column="set" sort={sort} onSort={onSort} />
              </th>
              <th className="px-3 py-2 font-normal">
                <SortHeader label="Trait" column="trait" sort={sort} onSort={onSort} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => {
              const it = g.item;
              const kind = it.bagCategory
                ? bagSubtypeLabel(it.bagCategory, it.bagSubtype, it.bagSubtypeLabel) || it.bagCategoryLabel || it.bagCategory
                : null;
              const setKey = `${it.setId ?? ""}|${it.setName ?? ""}`;
              return (
                <tr key={g.key} className="border-b border-border/50 align-top last:border-0 hover:bg-surface-2/40">
                  <td className="px-4 py-1.5">
                    <SetHover
                      className="block"
                      name={it.setName}
                      setId={it.setId}
                      itemName={it.name}
                      detail={[it.trait, it.level ? `CP${it.level}` : null].filter(Boolean).join(" · ") || undefined}
                    >
                      <span className={`font-medium ${qualityText(it.quality)}`}>{it.name}</span>
                      {it.stolen ? <Hand className="ml-1.5 inline h-3 w-3 text-danger" aria-label="Stolen" /> : null}
                      {kind || it.level ? (
                        <span className="ml-2 text-[11px] text-fg-subtle">
                          {[kind, it.level ? `CP${it.level}` : null].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </SetHover>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-fg">{g.total.toLocaleString("en-US")}</td>
                  <td className="px-3 py-1.5">
                    <span className="flex flex-wrap gap-1">
                      {g.holders.slice(0, SHOW_HOLDERS).map((h) => {
                        const label = h.owner ?? locationLabel(h.location);
                        const where = h.owner && h.location === "worn" ? " (worn)" : "";
                        const chip = (
                          <>
                            {label}
                            {where}
                            <span className="ml-1 tabular-nums text-fg-subtle">{h.count.toLocaleString("en-US")}</span>
                          </>
                        );
                        const id = h.owner ? characterIds[h.owner] : undefined;
                        return id ? (
                          <Link
                            key={`${h.owner}-${h.location}`}
                            href={`/party/c/${encodeURIComponent(id)}`}
                            className="rounded-md border border-border px-1.5 py-0.5 text-[12px] text-fg-muted hover:border-border-strong hover:text-fg"
                          >
                            {chip}
                          </Link>
                        ) : (
                          <span
                            key={`${h.owner ?? ""}-${h.location}`}
                            className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[12px] text-fg-muted"
                          >
                            {chip}
                          </span>
                        );
                      })}
                      {g.holders.length > SHOW_HOLDERS ? (
                        <span
                          className="px-1 py-0.5 text-[12px] text-fg-subtle"
                          title={g.holders
                            .slice(SHOW_HOLDERS)
                            .map((h) => `${h.owner ?? locationLabel(h.location)} ${h.count}`)
                            .join(", ")}
                        >
                          + {g.holders.length - SHOW_HOLDERS} more
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-fg-muted">
                    {it.setName ? (
                      <Link href={setHrefs[setKey] ?? "#"} className="text-accent hover:underline">
                        {it.setName}
                      </Link>
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-fg-muted">{it.trait ?? <span className="text-fg-subtle">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
