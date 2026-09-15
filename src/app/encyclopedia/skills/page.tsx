import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSkillLines } from "@/lib/db/catalog-queries";
import { charactersWithSkillLine } from "@/lib/db/overlay";
import { CatalogBrowser, type BrowserItem } from "@/components/catalog-browser";
import { PageHeader } from "@/components/ui";
import { getCatalogMeta } from "@/lib/catalog/import";
import { CatalogScanCallout } from "@/components/catalog-scan-callout";
import type { CatalogSource } from "@/lib/catalog/schema";

export const dynamic = "force-dynamic";

export default function SkillsPage() {
  let items: BrowserItem[] = [];
  try {
    items = getSkillLines().map(({ entry, source }) => {
      const chars = charactersWithSkillLine(entry.name);
      return {
        id: entry.id,
        name: entry.name,
        category: entry.category,
        source,
        href: `/encyclopedia/skills/${encodeURIComponent(entry.id)}`,
        subtitle: entry.className ?? (chars.length ? `known by ${chars.length}` : undefined),
        owned: chars.length > 0,
      };
    });
  } catch {
    items = [];
  }

  let source: CatalogSource | undefined;
  try {
    source = getCatalogMeta()?.source as CatalogSource | undefined;
  } catch {
    source = undefined;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/encyclopedia" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Encyclopedia
      </Link>
      <PageHeader title="Skills & Morphs" subtitle="Every skill line. Lines your characters have discovered are marked." />
      <CatalogScanCallout source={source} />
      <CatalogBrowser items={items} searchPlaceholder="Search skill lines…" ownedLabel="Discovered" />
    </div>
  );
}
