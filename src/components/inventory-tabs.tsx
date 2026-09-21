"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Backpack, Coins } from "lucide-react";

export function InventoryTabs({ current }: { current: "items" | "currency" }) {
  const pathname = usePathname();
  const tabs = [
    { id: "items" as const, href: pathname, label: "Items", icon: Backpack },
    { id: "currency" as const, href: `${pathname}?view=currency`, label: "Currency", icon: Coins },
  ];
  return (
    <div className="mb-6 inline-flex rounded-lg border border-border bg-surface p-1">
      {tabs.map(({ id, href, label, icon: Icon }) => {
        const active = current === id;
        return (
          <Link
            key={id}
            href={href}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
              active ? "bg-accent-soft text-accent" : "text-fg-muted hover:text-fg"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
