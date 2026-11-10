import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Boxes } from "lucide-react";
import type { CatalogSource } from "@/lib/catalog/schema";
import { CatalogScanCallout } from "@/components/catalog-scan-callout";
import { SourceBadge } from "@/components/source-badge";
import { AtlasPage, AtlasPanel } from "./ui";

export interface AtlasEncyclopediaDomain {
  href: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  count: number;
  unit: string;
}

/**
 * Atlas catalog hub — same domains as Classic Encyclopedia, quieter chrome.
 */
export function AtlasEncyclopediaHub({
  domains,
  source,
  patch,
  totalsLine,
}: {
  domains: AtlasEncyclopediaDomain[];
  source?: CatalogSource;
  patch?: string;
  totalsLine?: string;
}) {
  return (
    <AtlasPage
      grain="Catalog"
      title="Encyclopedia"
      subtitle="Live Tamriel reference over one shared database with your account. In-game data always wins."
      action={source ? <SourceBadge source={source} /> : undefined}
    >
      <CatalogScanCallout source={source} />

      <AtlasPanel className="mb-6">
        <p className="font-medium text-fg">Patch {patch ?? "U50"} · one shared catalog</p>
        <p className="mt-1 max-w-3xl text-sm text-fg-muted">
          Every set, skill, Champion star and scribing script links to your account — and your characters link
          back here. Reference-badged entries hold exact numbers until an in-game scan confirms them.
        </p>
      </AtlasPanel>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {domains.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className="group flex items-start gap-4 rounded-xl border border-border bg-surface/70 p-5 transition-colors hover:border-accent/50 hover:bg-surface-2"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent">
              <d.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="atlas-display text-lg text-fg group-hover:text-accent">{d.title}</span>
                <span className="rounded border border-accent/40 bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">
                  {d.count} {d.unit}
                </span>
              </span>
              <span className="mt-0.5 block text-sm text-fg-muted">{d.desc}</span>
            </span>
          </Link>
        ))}
      </div>

      {totalsLine ? (
        <AtlasPanel className="mt-6 flex items-center gap-3 text-sm text-fg-muted">
          <Boxes className="h-5 w-5 shrink-0 text-fg-subtle" />
          <p>{totalsLine}</p>
        </AtlasPanel>
      ) : null}
    </AtlasPage>
  );
}
