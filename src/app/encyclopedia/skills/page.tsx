import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSkillLines, getSkills } from "@/lib/db/catalog-queries";
import { charactersWithSkillLine } from "@/lib/db/overlay";
import { PageFrame, PageHeader } from "@/components/ui";
import { getCatalogMeta } from "@/lib/catalog/import";
import { CatalogScanCallout } from "@/components/catalog-scan-callout";
import { SkillCatalog, type SkillCatalogItem } from "@/components/skill-catalog";
import { plannerLineIcon } from "@/lib/icons/planner-icons";
import { resolveSkillIcon } from "@/lib/icons/skill-icons";
import type { CatalogSource } from "@/lib/catalog/schema";

export const dynamic = "force-dynamic";

export default function SkillsPage() {
  let items: SkillCatalogItem[] = [];
  try {
    const abilityIcon = new Map<string, string>();
    for (const { entry } of getSkills()) {
      if (abilityIcon.has(entry.lineId)) continue;
      const icon = entry.icon?.trim() || resolveSkillIcon(entry.name, entry.morphs.map((morph) => morph.name));
      if (icon) abilityIcon.set(entry.lineId, icon);
    }
    items = getSkillLines().map(({ entry }) => {
      const chars = charactersWithSkillLine(entry.name);
      return {
        id: entry.id,
        name: entry.name,
        href: `/encyclopedia/skills/${encodeURIComponent(entry.id)}`,
        category: entry.category,
        className: entry.className,
        icon: plannerLineIcon({
          name: entry.name,
          className: entry.className,
          catalogIcon: entry.icon,
          abilityIcon: abilityIcon.get(entry.id),
        }),
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
    <PageFrame>
      <Link href="/encyclopedia" className="mb-4 inline-flex shrink-0 items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Encyclopedia
      </Link>
      <PageHeader
        title="Skills & Morphs"
        subtitle="Grouped the way the skill window groups them. A green dot means a character has discovered the line."
      />
      <CatalogScanCallout source={source} />
      <SkillCatalog items={items} />
    </PageFrame>
  );
}
