import { Feather, Shirt, Star, Swords } from "lucide-react";
import { catalogCount } from "@/lib/db/catalog-queries";
import { getCatalogMeta } from "@/lib/catalog/import";
import { AtlasEncyclopediaHub } from "@/components/atlas/encyclopedia";
import type { CatalogSource } from "@/lib/catalog/schema";

export const dynamic = "force-dynamic";

export default function EncyclopediaPage() {
  const meta = safe(() => getCatalogMeta());
  const counts = {
    set: safe(() => catalogCount("set")) ?? 0,
    skill: safe(() => catalogCount("skill")) ?? 0,
    skillline: safe(() => catalogCount("skillline")) ?? 0,
    cp: safe(() => catalogCount("cp")) ?? 0,
    grimoire: safe(() => catalogCount("grimoire")) ?? 0,
    script: safe(() => catalogCount("script")) ?? 0,
  };

  const domains = [
    { href: "/encyclopedia/sets", title: "Item Sets", desc: "Bonuses, pieces, drop sources.", icon: Shirt, count: counts.set, unit: "sets" },
    { href: "/encyclopedia/skills", title: "Skills & Morphs", desc: "Every line, ability and morph.", icon: Swords, count: counts.skillline, unit: "lines" },
    { href: "/encyclopedia/champion-points", title: "Champion Points", desc: "The live constellation stars.", icon: Star, count: counts.cp, unit: "stars" },
    { href: "/encyclopedia/scribing", title: "Scribing", desc: "Grimoires, scripts, full combinations.", icon: Feather, count: counts.grimoire, unit: "grimoires" },
  ];

  const totalsLine = `${counts.set} sets · ${counts.skillline} skill lines · ${counts.skill} abilities · ${counts.cp} CP stars · ${counts.grimoire} grimoires · ${counts.script} scripts in the catalog. More domains (items, collectibles, antiquities, quests) ingest per patch into this same database.`;

  return (
    <AtlasEncyclopediaHub
          domains={domains}
          source={meta?.source as CatalogSource | undefined}
          patch={meta?.patch}
          totalsLine={totalsLine}
        />
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
