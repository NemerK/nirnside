import Link from "next/link";
import { ArrowLeft, Shirt } from "lucide-react";
import { getStickerbook } from "@/lib/db/queries";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Item Sets catalog. For now this is derived from sets your account has actually
 * encountered (via the stickerbook), so every entry here is in-game verified.
 * The full live-catalog ingest will add unowned sets, tagged by source.
 */
export default function EncyclopediaSetsPage() {
  let sets: ReturnType<typeof getStickerbook> = [];
  try {
    sets = getStickerbook();
  } catch {
    sets = [];
  }

  const byCategory = new Map<string, typeof sets>();
  for (const s of sets) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s);
    byCategory.set(s.category, list);
  }
  const categories = Array.from(byCategory.keys()).sort();

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/encyclopedia" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Encyclopedia
      </Link>
      <PageHeader
        title="Item Sets"
        subtitle="Sets known to your account, with your collection progress. Full unowned catalog arrives with per-patch ingest."
        action={<Badge tone="ok">In-game verified</Badge>}
      />

      {sets.length === 0 ? (
        <EmptyState title="No sets known yet" icon={<Shirt className="h-8 w-8" />}>
          Import a snapshot to populate the set catalog from what your account has seen.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {categories.map((cat) => (
            <section key={cat}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-fg-subtle">{cat}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {byCategory.get(cat)!.map((s) => {
                  const complete = s.total > 0 && s.collected === s.total;
                  return (
                    <Card key={s.setId} className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-fg">{s.name}</span>
                        <span className="text-xs text-fg-muted">
                          {s.collected}/{s.total} collected
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(s.pieces).map(([slot, owned]) => (
                          <span
                            key={slot}
                            className={`rounded-md border px-1.5 py-0.5 text-[10px] ${
                              owned
                                ? "border-accent/40 bg-accent-soft text-accent"
                                : "border-border/70 text-fg-subtle"
                            }`}
                          >
                            {slot}
                          </span>
                        ))}
                      </div>
                      {complete && (
                        <div className="mt-2">
                          <Badge tone="accent">Fully collected</Badge>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
