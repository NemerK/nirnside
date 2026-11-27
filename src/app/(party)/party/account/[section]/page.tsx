import { notFound } from "next/navigation";
import { PageHead } from "@/components/party/page-head";
import { ACCOUNT_SECTIONS, type AccountSection } from "@/components/party/areas";
import {
  AchievementsSection,
  HousesSection,
  InventorySection,
  SECTION_TITLES,
  SetsSection,
  StylesSection,
} from "@/components/party/scope-sections";

export const dynamic = "force-dynamic";

type Params = Record<string, string | string[] | undefined>;

/** The account-wide sections: shared by every character. */
export default async function AccountSectionPage({ params, searchParams }: PageProps<"/party/account/[section]">) {
  const { section } = await params;
  const sp = (await searchParams) as Params;
  if (!ACCOUNT_SECTIONS.some((s) => s.id === section && s.id !== "")) notFound();
  const id = section as AccountSection;
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHead title={SECTION_TITLES[id].title} lead={SECTION_TITLES[id].lead} />
      {id === "inventory" ? (
        <InventorySection sp={sp} />
      ) : id === "sets" ? (
        <SetsSection sp={sp} />
      ) : id === "achievements" ? (
        <AchievementsSection />
      ) : id === "styles" ? (
        <StylesSection sp={sp} />
      ) : (
        <HousesSection />
      )}
    </div>
  );
}
