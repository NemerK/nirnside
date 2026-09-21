"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import type { FacetValues } from "@/lib/db/queries";
import { locationLabel } from "@/lib/format";

export function InventoryFilters({ facets }: { facets: FacetValues }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(params.get("search") ?? "");

  // Debounced push of the search box into the URL (deep-linkable filters).
  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (search) next.set("search", search);
      else next.delete("search");
      startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function clearAll() {
    setSearch("");
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  const hasFilters =
    !!search ||
    ["location", "quality", "setName", "trait", "owner"].some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search items or sets…"
          className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
        />
      </div>

      <FilterSelect label="Location" value={params.get("location") ?? ""} onChange={(v) => setParam("location", v)}
        options={facets.locations.map((l) => ({ value: l, label: locationLabel(l) }))} />
      <FilterSelect label="Quality" value={params.get("quality") ?? ""} onChange={(v) => setParam("quality", v)}
        options={facets.qualities.map((q) => ({ value: q, label: cap(q) }))} />
      <FilterSelect label="Set" value={params.get("setName") ?? ""} onChange={(v) => setParam("setName", v)}
        options={facets.sets.map((s) => ({ value: s, label: s }))} />
      <FilterSelect label="Trait" value={params.get("trait") ?? ""} onChange={(v) => setParam("trait", v)}
        options={facets.traits.map((t) => ({ value: t, label: t }))} />
      <FilterSelect label="Owner" value={params.get("owner") ?? ""} onChange={(v) => setParam("owner", v)}
        options={facets.owners.map((o) => ({ value: o, label: o }))} />

      {hasFilters && (
        <button
          onClick={clearAll}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-sm text-fg-muted hover:text-fg"
        >
          <X className="h-4 w-4" /> Clear
        </button>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  if (options.length === 0) return null;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-lg border bg-surface py-2 pl-2.5 pr-7 text-sm focus:border-accent focus:outline-none ${
        value ? "border-accent/50 text-fg" : "border-border text-fg-muted"
      }`}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
