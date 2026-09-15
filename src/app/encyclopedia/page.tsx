import Link from "next/link";
import { BadgeCheck, Boxes, Feather, Shirt, Star, Swords } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { catalogCount } from "@/lib/db/catalog-queries";
import { getCatalogMeta } from "@/lib/catalog/import";
import { SourceBadge } from "@/components/source-badge";
import { CatalogScanCallout } from "@/components/catalog-scan-callout";
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

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Encyclopedia"
        subtitle="Live Tamriel reference, sharing one database with your account. In-game data always wins."
        action={meta ? <SourceBadge source={meta.source as CatalogSource} /> : undefined}
      />

      <CatalogScanCallout source={meta?.source as CatalogSource | undefined} />

      <Card className="mb-6 flex items-start gap-3 p-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent">
          <BadgeCheck className="h-5 w-5" />
        </span>
        <div className="text-sm text-fg-muted">
          <p className="font-medium text-fg">Patch {meta?.patch ?? "U50"} · one shared catalog</p>
          <p className="mt-1 max-w-3xl">
            Every set, skill, Champion star and scribing script here links to your account — and your characters link
            back to these pages. Entries badged{" "}
            <Badge tone="muted" className="align-middle">
              Reference
            </Badge>{" "}
            show mechanics but hold exact numbers until an in-game scan confirms them; the{" "}
            <code className="rounded bg-surface-2 px-1">NirnsideCatalog</code> addon upgrades them to{" "}
            <Badge tone="ok" className="align-middle">
              In-game verified
            </Badge>
            . Only current live-patch content appears — nothing deprecated.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {domains.map((d) => (
          <Link
            key={d.title}
            href={d.href}
            className="group flex items-start gap-4 rounded-xl border border-border bg-surface/70 p-5 transition-colors hover:border-accent/50 hover:bg-surface-2"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent">
              <d.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="font-medium text-fg group-hover:text-accent">{d.title}</span>
                <Badge tone="accent">
                  {d.count} {d.unit}
                </Badge>
              </span>
              <span className="mt-0.5 block text-sm text-fg-muted">{d.desc}</span>
            </span>
          </Link>
        ))}
      </div>

      <Card className="mt-6 flex items-center gap-3 p-4 text-sm text-fg-muted">
        <Boxes className="h-5 w-5 shrink-0 text-fg-subtle" />
        <p>
          {counts.set} sets · {counts.skillline} skill lines · {counts.skill} abilities · {counts.cp} CP stars ·{" "}
          {counts.grimoire} grimoires · {counts.script} scripts in the catalog. More domains (items, collectibles,
          antiquities, quests) ingest per patch into this same database.
        </p>
      </Card>
    </div>
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
