import Link from "next/link";
import {
  BadgeCheck,
  Boxes,
  Feather,
  Library,
  Shirt,
  Sparkles,
  Star,
  Swords,
} from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getStickerbook } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const DOMAINS = [
  { href: "/encyclopedia/sets", title: "Item Sets", desc: "Bonuses, pieces, drop sources.", icon: Shirt, ready: true },
  { href: "/encyclopedia", title: "Skills & Morphs", desc: "Every line, morph and skill style.", icon: Swords, ready: false },
  { href: "/encyclopedia", title: "Scribing", desc: "Grimoires, scripts, full combinations.", icon: Feather, ready: false },
  { href: "/encyclopedia", title: "Champion Points", desc: "The live constellation tree.", icon: Star, ready: false },
  { href: "/encyclopedia", title: "Items", desc: "All item definitions and tooltips.", icon: Boxes, ready: false },
  { href: "/encyclopedia", title: "Collectibles", desc: "Motifs, mounts, styles, dyes.", icon: Sparkles, ready: false },
];

export default function EncyclopediaPage() {
  let knownSets = 0;
  try {
    knownSets = getStickerbook().length;
  } catch {
    knownSets = 0;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Encyclopedia"
        subtitle="Live Tamriel reference. Accuracy first — in-game data always wins over community sources."
      />

      <Card className="mb-6 flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent">
            <BadgeCheck className="h-5 w-5" />
          </span>
          <div className="text-sm text-fg-muted">
            <p className="font-medium text-fg">How the catalog is sourced</p>
            <p className="mt-1 max-w-2xl">
              Data confirmed against your in-game snapshots is tagged{" "}
              <Badge tone="ok" className="align-middle">
                In-game verified
              </Badge>
              . Anything filled from community databases before verification is tagged{" "}
              <Badge tone="muted" className="align-middle">
                Community
              </Badge>{" "}
              and never presented as confirmed. The catalog tracks the current live patch only — nothing deprecated.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DOMAINS.map((d) => {
          const Inner = (
            <>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent">
                <d.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="font-medium text-fg">{d.title}</span>
                  {d.ready ? (
                    <Badge tone="ok">
                      {d.title === "Item Sets" ? `${knownSets} verified` : "Ready"}
                    </Badge>
                  ) : (
                    <Badge tone="muted">Planned</Badge>
                  )}
                </span>
                <span className="mt-0.5 block text-sm text-fg-muted">{d.desc}</span>
              </span>
            </>
          );
          return d.ready ? (
            <Link
              key={d.title}
              href={d.href}
              className="group flex items-start gap-4 rounded-xl border border-border bg-surface/70 p-5 transition-colors hover:border-accent/50 hover:bg-surface-2"
            >
              {Inner}
            </Link>
          ) : (
            <div key={d.title} className="flex items-start gap-4 rounded-xl border border-border bg-surface/40 p-5 opacity-80">
              {Inner}
            </div>
          );
        })}
      </div>

      <Card className="mt-6 flex items-start gap-3 p-5 text-sm text-fg-muted">
        <Library className="mt-0.5 h-5 w-5 shrink-0 text-fg-subtle" />
        <p>
          The encyclopedia and your account view share one local database, so pages can show your progress right on a
          set or skill. The full live catalog (skills, scribing, CP, items) is ingested per patch — see{" "}
          <code className="rounded bg-surface-2 px-1">.cursor/rules/nirnside.mdc</code> for the accuracy rules that
          govern it.
        </p>
      </Card>
    </div>
  );
}
