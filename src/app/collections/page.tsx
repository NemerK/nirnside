import Link from "next/link";
import { BookMarked, Home, Shirt } from "lucide-react";
import { getHouses, getOutfitStyles, getStickerbook, getStickerbookStats } from "@/lib/db/queries";
import { presentCollections } from "@/lib/collections/present";
import { LookSwitch } from "@/components/look-switch";
import { AtlasCollectionsHub } from "@/components/atlas/collections-hub";
import { Card, PageFrame, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" ? sp.tab : undefined;

  const stickerbook = safe(() => getStickerbook()) ?? [];
  const stickerStats = safe(() => getStickerbookStats()) ?? { total: 0, collected: 0, sets: 0 };
  const outfitStyles = safe(() => getOutfitStyles()) ?? [];
  const houses = safe(() => getHouses()) ?? [];
  const collections = presentCollections({
    stickerbook,
    stickerStats,
    outfitStyles,
    houses,
  });

  return (
    <LookSwitch
      classic={
        <PageFrame>
          <PageHeader
            title="Collections"
            subtitle="In Classic, set pieces, outfit styles, and houses each have their own page. Atlas folds them into one hub."
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ClassicLink
              href="/stickerbook"
              icon={BookMarked}
              title="Stickerbook"
              hint={
                collections.sets.total
                  ? `${collections.sets.pct}% · ${collections.sets.collected}/${collections.sets.total}`
                  : "Set piece reconstruction"
              }
            />
            <ClassicLink
              href="/styles"
              icon={Shirt}
              title="Outfit Styles"
              hint={
                collections.styles.total
                  ? `${collections.styles.unlocked}/${collections.styles.total} unlocked`
                  : "Collections → Outfit Styles"
              }
            />
            <ClassicLink
              href="/houses"
              icon={Home}
              title="Houses"
              hint={
                collections.houses.total
                  ? `${collections.houses.total} owned`
                  : "Owned residences"
              }
            />
          </div>
        </PageFrame>
      }
      atlas={<AtlasCollectionsHub collections={collections} tab={tab} />}
    />
  );
}

function ClassicLink({
  href,
  icon: Icon,
  title,
  hint,
}: {
  href: string;
  icon: typeof BookMarked;
  title: string;
  hint: string;
}) {
  return (
    <Link href={href} className="block transition hover:brightness-110">
      <Card className="flex items-start gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent">
          <Icon className="h-5 w-5" />
        </span>
        <span>
          <span className="block font-medium text-fg">{title}</span>
          <span className="mt-0.5 block text-sm text-fg-muted">{hint}</span>
        </span>
      </Card>
    </Link>
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
