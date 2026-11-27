import { PageHead } from "@/components/party/page-head";
import { CraftingSection, SECTION_TITLES } from "@/components/party/scope-sections";

export const dynamic = "force-dynamic";

/** Characters: Craft knowledge. */
export default async function Page({ searchParams }: PageProps<"/party/knowledge">) {
  const sp = (await searchParams) as Record<string, string | string[] | undefined>;
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHead title="Craft knowledge" lead={SECTION_TITLES.crafting.lead} />
      <CraftingSection sp={sp} />
    </div>
  );
}
