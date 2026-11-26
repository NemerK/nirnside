import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCPStars } from "@/lib/db/catalog-queries";
import { getChampionAllocations } from "@/lib/db/queries";
import { getCatalogMeta } from "@/lib/catalog/import";
import { PageFrame, PageHeader } from "@/components/ui";
import { SourceBadge } from "@/components/source-badge";
import { CatalogScanCallout } from "@/components/catalog-scan-callout";
import { CPView, type CPDiscipline, type CPCharacterAlloc } from "@/components/cp-view";
import type { CatalogSource } from "@/lib/catalog/schema";

export const dynamic = "force-dynamic";

const ORDER = ["Warfare", "Fitness", "Craft"];

export default function ChampionPointsPage() {
  const meta = safe(() => getCatalogMeta());
  const stars = safe(() => getCPStars()) ?? [];

  const byDisc = new Map<string, CPDiscipline>();
  for (const { entry } of stars) {
    if (!byDisc.has(entry.category)) byDisc.set(entry.category, { name: entry.category, stars: [] });
    byDisc.get(entry.category)!.stars.push({
      id: entry.id,
      name: entry.name,
      type: entry.type,
      description: entry.description,
      maxPoints: entry.maxPoints,
    });
  }
  const disciplines = ORDER.filter((o) => byDisc.has(o)).map((o) => byDisc.get(o)!);

  const characters: CPCharacterAlloc[] = (safe(() => getChampionAllocations()) ?? []).map((c) => {
    const alloc: CPCharacterAlloc["alloc"] = {};
    for (const disc of c.champion) {
      for (const s of disc.stars) alloc[s.name.toLowerCase()] = { points: s.points, slotted: s.slotted };
    }
    return { id: c.id, name: c.name, alloc };
  });

  return (
    <PageFrame>
      <Link href="/encyclopedia" className="mb-4 inline-flex shrink-0 items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Encyclopedia
      </Link>
      <PageHeader
        title="Champion Points"
        subtitle="The live constellation. Browse the tree with your investments overlaid, or plan a build."
        action={meta ? <SourceBadge source={meta.source as CatalogSource} /> : undefined}
      />
      <CatalogScanCallout source={meta?.source as CatalogSource | undefined} />
      <CPView disciplines={disciplines} characters={characters} />
    </PageFrame>
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
