import { PageHead } from "@/components/party/page-head";
import { CraftingSection, SECTION_TITLES } from "@/components/party/scope-sections";

export const dynamic = "force-dynamic";

/** Across characters: crafting for everyone at once. */
export default async function AcrossCraftingPage({ searchParams }: PageProps<"/party/across/crafting">) {
  const sp = (await searchParams) as Record<string, string | string[] | undefined>;
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHead title={SECTION_TITLES.crafting.title} lead={SECTION_TITLES.crafting.lead} />
      <CraftingSection sp={sp} />
    </div>
  );
}
