"use client";

import type { ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { BAG_CATEGORIES, bagCategoryLabel, bagSubtypeLabel } from "@/lib/inventory/bag-filters";

export function InventoryCategories({
  counts,
  labels,
  untagged,
}: {
  counts: Record<string, { total: number; subs: Record<string, number> }>;
  /** Client-provided tab labels from the latest snapshot, keyed by stable id. */
  labels: Record<string, string>;
  untagged: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const category = params.get("bag") ?? "";
  const subtype = params.get("sub") ?? "";
  const active = BAG_CATEGORIES.find((row) => row.id === category);

  function setBag(nextCategory: string, nextSubtype = "") {
    const next = new URLSearchParams(params.toString());
    if (nextCategory) next.set("bag", nextCategory);
    else next.delete("bag");
    if (nextSubtype) next.set("sub", nextSubtype);
    else next.delete("sub");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        <TabButton active={!category} onClick={() => setBag("")}>
          All
        </TabButton>
        {BAG_CATEGORIES.map((row) => (
          <TabButton
            key={row.id}
            active={category === row.id}
            onClick={() => setBag(category === row.id ? "" : row.id)}
          >
            {bagCategoryLabel(row.id, labels[row.id])}
            <span className="ml-1 tabular-nums text-fg-subtle">{counts[row.id]?.total ?? 0}</span>
          </TabButton>
        ))}
      </div>
      {active && active.subs.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          <TabButton active={!subtype} onClick={() => setBag(active.id)}>
            All {bagCategoryLabel(active.id, labels[active.id])}
          </TabButton>
          {active.subs.map((sub) => (
            <TabButton
              key={sub.id}
              active={subtype === sub.id}
              onClick={() => setBag(active.id, subtype === sub.id ? "" : sub.id)}
            >
              {bagSubtypeLabel(active.id, sub.id, labels[`${active.id}:${sub.id}`])}
              <span className="ml-1 tabular-nums text-fg-subtle">{counts[active.id]?.subs[sub.id] ?? 0}</span>
            </TabButton>
          ))}
        </div>
      ) : null}
      {untagged > 0 ? (
        <p className="text-xs text-fg-subtle">
          {untagged.toLocaleString("en-US")} stacks are not in a tab yet. Log out once with the updated addon
          and they sort the same way as the game.
        </p>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2.5 py-1 text-xs ${
        active
          ? "border-accent/50 bg-accent-soft font-medium text-accent"
          : "border-border text-fg-muted hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
