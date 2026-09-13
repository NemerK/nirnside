import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Backpack, BookMarked, MapPin } from "lucide-react";
import { getSet } from "@/lib/db/catalog-queries";
import { setOwnership } from "@/lib/db/overlay";
import { Badge, Card, PageHeader, ProgressBar } from "@/components/ui";
import { GameIcon } from "@/components/game-icon";
import { SourceBadge, UnverifiedNote } from "@/components/source-badge";

export const dynamic = "force-dynamic";

export default async function SetDetailPage({ params }: PageProps<"/encyclopedia/sets/[id]">) {
  const { id } = await params;
  const row = safe(() => getSet(decodeURIComponent(id)));
  if (!row) notFound();
  const { entry: s, source } = row;
  const own = safe(() => setOwnership(s.name)) ?? { inventoryCount: 0, sticker: null };

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/encyclopedia/sets" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Item Sets
      </Link>

      <Card className="mb-6 p-6">
        <div className="flex items-start gap-4">
          <GameIcon name={s.name} icon={s.icon} size={56} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-fg">{s.name}</h1>
              <SourceBadge source={source} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
              <Badge tone="muted">{s.category}</Badge>
              {s.dlc && <Badge tone="muted">{s.dlc}</Badge>}
              <span>Up to {s.maxEquip} pieces</span>
              {s.traitsNeeded != null && <span>· {s.traitsNeeded} traits to craft</span>}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Set Bonuses</h2>
          <Card className="p-4">
            {s.bonuses.length === 0 ? (
              <p className="text-sm text-fg-muted">Bonuses pending in-game scan.</p>
            ) : (
              <ul className="space-y-2.5">
                {s.bonuses.map((b, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-8 shrink-0 items-center justify-center rounded border border-accent/40 bg-accent-soft text-xs font-semibold text-accent">
                      {b.pieces}
                    </span>
                    <span className="text-sm text-fg">{b.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <UnverifiedNote source={source} />
          </Card>

          {s.dropSource && (
            <div className="mt-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Source</h2>
              <Card className="flex items-center gap-2 p-4 text-sm text-fg">
                <MapPin className="h-4 w-4 text-accent" /> {s.dropSource}
              </Card>
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Your Progress</h2>
          <Card className="space-y-4 p-4">
            {own.sticker ? (
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-fg">
                    <BookMarked className="h-4 w-4 text-accent" /> Stickerbook
                  </span>
                  <span className="text-fg-muted">
                    {own.sticker.collected}/{own.sticker.total}
                  </span>
                </div>
                <ProgressBar value={own.sticker.collected} max={own.sticker.total} />
              </div>
            ) : (
              <p className="text-sm text-fg-muted">Not in your stickerbook yet.</p>
            )}
            <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="flex items-center gap-1.5 text-fg">
                <Backpack className="h-4 w-4 text-accent" /> In your bags
              </span>
              <span className="text-fg-muted">{own.inventoryCount}</span>
            </div>
            {own.inventoryCount > 0 && (
              <Link
                href={`/inventory?setName=${encodeURIComponent(s.name)}`}
                className="block text-sm text-accent hover:underline"
              >
                View in inventory →
              </Link>
            )}
          </Card>
        </div>
      </div>
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
