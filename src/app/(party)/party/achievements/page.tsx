import { PageHead } from "@/components/party/page-head";
import { AchievementsSection, SECTION_TITLES } from "@/components/party/scope-sections";

export const dynamic = "force-dynamic";

/** Account: Achievements. */
export default function Page() {
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHead title="Achievements" lead={SECTION_TITLES.achievements.lead} />
      <AchievementsSection />
    </div>
  );
}
