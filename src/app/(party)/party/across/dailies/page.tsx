import { PageHead } from "@/components/party/page-head";
import { DailiesSection, SECTION_TITLES } from "@/components/party/scope-sections";

export const dynamic = "force-dynamic";

/** Across characters: dailies for everyone at once. */
export default function AcrossDailiesPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHead title={SECTION_TITLES.dailies.title} lead={SECTION_TITLES.dailies.lead} />
      <DailiesSection />
    </div>
  );
}
