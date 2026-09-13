import { BookMarked } from "lucide-react";
import { getStickerbook, getStickerbookStats } from "@/lib/db/queries";
import { setHref } from "@/lib/db/catalog-queries";
import { StickerbookGrid } from "@/components/stickerbook-grid";
import { EmptyState, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function StickerbookPage() {
  let sets: ReturnType<typeof getStickerbook> = [];
  let stats: ReturnType<typeof getStickerbookStats> = { total: 0, collected: 0, sets: 0 };
  try {
    sets = getStickerbook();
    stats = getStickerbookStats();
  } catch {
    // leave defaults
  }

  const pct = stats.total ? Math.round((stats.collected / stats.total) * 100) : 0;
  const completeSets = sets.filter((s) => s.total > 0 && s.collected === s.total).length;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Stickerbook"
        subtitle="Your item set collection — what you've reconstructed and what's still missing."
      />

      {sets.length === 0 ? (
        <EmptyState title="Stickerbook is empty" icon={<BookMarked className="h-8 w-8" />}>
          Log out with the addon installed to capture your collection, or run{" "}
          <code className="rounded bg-surface-2 px-1">npm run seed</code> for sample data.
        </EmptyState>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Overall" value={`${pct}%`} hint={`${stats.collected}/${stats.total} pieces`} />
            <Stat label="Sets tracked" value={stats.sets} />
            <Stat label="Complete sets" value={completeSets} />
            <Stat label="Pieces missing" value={stats.total - stats.collected} />
          </div>
          <StickerbookGrid
            sets={sets.map((s) => ({ ...s, href: setHref({ name: s.name, setId: s.setId }) }))}
          />
        </>
      )}
    </div>
  );
}
