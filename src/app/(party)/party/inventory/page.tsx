import { PageHead } from "@/components/party/page-head";
import { TreasuryStrip } from "@/components/party/treasury";
import { InventorySection, SECTION_TITLES } from "@/components/party/scope-sections";
import { account, treasury } from "@/lib/party/overview";
import { roster } from "@/lib/party/data";

export const dynamic = "force-dynamic";

/** Account: every bag (worn, backpacks, bank, craft bag) and the wallet. */
export default async function InventoryPage({ searchParams }: PageProps<"/party/inventory">) {
  const sp = (await searchParams) as Record<string, string | string[] | undefined>;
  const a = account();
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHead title={SECTION_TITLES.inventory.title} lead={SECTION_TITLES.inventory.lead} />
      {a ? <TreasuryStrip t={treasury(a, roster())} perCharacterHref="/party/inventory?view=currency" /> : null}
      <InventorySection sp={sp} />
    </div>
  );
}
