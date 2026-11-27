import { PageHead } from "@/components/party/page-head";
import { DailiesSection, SECTION_TITLES } from "@/components/party/scope-sections";

export const dynamic = "force-dynamic";

/** Account: Dailies. */
export default function Page() {
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHead title="Dailies" lead={SECTION_TITLES.dailies.lead} />
      <DailiesSection />
    </div>
  );
}
