import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSets } from "@/lib/db/catalog-queries";
import { setOwnership } from "@/lib/db/overlay";
import { CatalogBrowser, type BrowserItem } from "@/components/catalog-browser";
import { PageHeader } from "@/components/ui";
import { getCatalogMeta } from "@/lib/catalog/import";
import { CatalogScanCallout } from "@/components/catalog-scan-callout";
import type { CatalogSource } from "@/lib/catalog/schema";

export const dynamic = "force-dynamic";

export default async function SetsPage({ searchParams }: PageProps<"/encyclopedia/sets">) {
  const sp = await searchParams;
  const initialSearch = typeof sp.search === "string" ? sp.search : "";

  let items: BrowserItem[] = [];
  try {
    items = getSets().map(({ entry, source }) => {
      const own = setOwnership(entry.name);
      const owned = own.inventoryCount > 0 || (own.sticker?.collected ?? 0) > 0;
      const subtitle = own.sticker
        ? `${own.sticker.collected}/${own.sticker.total} collected`
        : own.inventoryCount > 0
          ? `${own.inventoryCount} in bags`
          : entry.dropSource ?? undefined;
      return {
        id: entry.id,
        name: entry.name,
        category: entry.category,
        source,
        href: `/encyclopedia/sets/${encodeURIComponent(entry.id)}`,
        subtitle,
        icon: entry.icon,
        owned,
      };
    });
  } catch {
    items = [];
  }

  function safeSource(): CatalogSource | undefined {
    try {
      return getCatalogMeta()?.source as CatalogSource | undefined;
    } catch {
      return undefined;
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/encyclopedia" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Encyclopedia
      </Link>
      <PageHeader title="Item Sets" subtitle="Every set in the catalog, with your ownership shown inline." />
      <CatalogScanCallout source={safeSource()} />
      <CatalogBrowser items={items} searchPlaceholder="Search sets…" initialSearch={initialSearch} ownedLabel="Owned" />
    </div>
  );
}
