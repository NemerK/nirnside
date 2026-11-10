import type { ReactNode } from "react";
import Link from "next/link";
import { Backpack, Coins } from "lucide-react";
import { AtlasPage } from "./ui";

/**
 * Atlas chrome around the existing inventory filters/table. Tabs keep the same
 * `?view=currency` contract Classic already uses.
 */
export function AtlasInventoryChrome({
  view,
  children,
}: {
  view: "items" | "currency";
  children: ReactNode;
}) {
  const tabs = [
    { id: "items" as const, href: "/inventory", label: "Items", icon: Backpack },
    { id: "currency" as const, href: "/inventory?view=currency", label: "Currency", icon: Coins },
  ];

  return (
    <AtlasPage
      grain="Account"
      title="Inventory"
      subtitle={
        view === "currency"
          ? "Gold, Tel Var, and Alliance Points per character, plus account-wide currencies."
          : "Bags, bank, craft bag — live stacks only. Deleted characters keep last-known bags on Archive."
      }
      action={
        <div className="inline-flex rounded-md border border-border bg-surface p-1">
          {tabs.map(({ id, href, label, icon: Icon }) => {
            const active = view === id;
            return (
              <Link
                key={id}
                href={href}
                className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium ${
                  active ? "bg-accent-soft text-accent" : "text-fg-muted hover:text-fg"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-col">{children}</div>
    </AtlasPage>
  );
}
