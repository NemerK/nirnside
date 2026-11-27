import { PageHead } from "@/components/party/page-head";
import { SubTabs } from "@/components/party/sub-tabs";
import { COLLECTION_TABS, type CollectionTab } from "@/components/party/areas";
import { HousesSection, SetsSection, StylesSection } from "@/components/party/scope-sections";

export const dynamic = "force-dynamic";

const LEAD: Record<CollectionTab, string> = {
  sets: "Set pieces and mythics collected on the account.",
  styles: "Outfit styles unlocked, as the game's Collections tree lists them.",
  houses: "Houses this account owns. House banks are never collected.",
};

/** Account: what the account has collected, one tab per kind. */
export default async function CollectionsPage({ searchParams }: PageProps<"/party/collections">) {
  const sp = (await searchParams) as Record<string, string | string[] | undefined>;
  const tab: CollectionTab = COLLECTION_TABS.some((t) => t.id === sp.tab) ? (sp.tab as CollectionTab) : "sets";
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHead title="Collections" lead={LEAD[tab]} />
      <SubTabs
        label="Collections"
        tabs={COLLECTION_TABS.map((t) => ({ href: `/party/collections?tab=${t.id}`, label: t.label, on: t.id === tab }))}
      />
      {tab === "sets" ? <SetsSection sp={sp} /> : tab === "styles" ? <StylesSection sp={sp} /> : <HousesSection />}
    </div>
  );
}
