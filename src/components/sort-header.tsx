"use client";

import { useCallback, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toggleSort, type SortState } from "@/lib/ui/column-sort";

export function useSort<K extends string>(initial: SortState<K> = null) {
  const [sort, setSort] = useState<SortState<K>>(initial);
  const onSort = useCallback((key: K) => setSort((current) => toggleSort(current, key)), []);
  const clear = useCallback(() => setSort(null), []);
  return { sort, onSort, clear };
}

export function SortHeader<K extends string>({
  label,
  column,
  sort,
  onSort,
  align = "left",
  title,
}: {
  label: string;
  column: K;
  sort: SortState<K>;
  onSort: (column: K) => void;
  align?: "left" | "right" | "center";
  title?: string;
}) {
  const active = sort?.key === column;
  return (
    <button
      type="button"
      title={title ?? `Sort by ${label}`}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      onClick={() => onSort(column)}
      className={`inline-flex max-w-full items-center gap-1 uppercase tracking-wider ${
        align === "right" ? "w-full justify-end" : align === "center" ? "w-full justify-center" : "text-left"
      } ${active ? "text-fg" : "text-fg-subtle hover:text-fg"}`}
    >
      <span className="truncate">{label}</span>
      {active ? (
        sort.dir === "asc" ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />
      ) : null}
    </button>
  );
}
