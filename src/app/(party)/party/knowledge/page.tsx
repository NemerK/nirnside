import { PageHead } from "@/components/party/page-head";
import { SubTabs } from "@/components/party/sub-tabs";
import { Empty } from "@/components/party/module";
import { CraftingSection, SECTION_TITLES } from "@/components/party/scope-sections";
import { PartyKnowledge } from "@/components/party/knowledge-view";
import type { KnowledgeTab } from "@/components/knowledge-board";
import { getCharactersFull } from "@/lib/db/queries";
import { liveCharacters } from "@/lib/snapshot/roster";
import { applyRosterOrder, getRosterOrder } from "@/lib/roster/order";
import {
  characterHasKnowledgeScan,
  presentRecipeLists,
  presentResearch,
  summarizeAccountKnowledge,
} from "@/lib/knowledge/present";

export const dynamic = "force-dynamic";

const TABS = new Set<KnowledgeTab>(["research", "motifs", "recipes", "plans"]);

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * Characters: Craft knowledge. What each character has learned (as Atlas
 * shows it), plus the cross-character "who can craft this set" check.
 */
export default async function Page({ searchParams }: PageProps<"/party/knowledge">) {
  const sp = (await searchParams) as Record<string, string | string[] | undefined>;
  const view = sp.view === "craft" ? "craft" : "characters";
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

  const tabs = (
    <SubTabs
      label="Craft knowledge views"
      tabs={[
        { href: "/party/knowledge", label: "By character", on: view === "characters" },
        { href: "/party/knowledge?view=craft", label: "Who can craft a set", on: view === "craft" },
      ]}
    />
  );

  if (view === "craft") {
    return (
      <div className="mx-auto w-full max-w-[1400px]">
        <PageHead title="Craft knowledge" lead="Which characters can make each piece of a crafted set, and with which trait." />
        {tabs}
        <CraftingSection sp={sp} />
      </div>
    );
  }

  const characters = applyRosterOrder(
    liveCharacters(safe(() => getCharactersFull(), [])),
    safe(() => getRosterOrder(), []),
  );
  const summary = summarizeAccountKnowledge(characters);
  const totals = [
    { label: "Research", done: summary.researchKnown, total: summary.researchTotal },
    { label: "Motifs", done: summary.motifKnown, total: summary.motifTotal },
    { label: "Recipes", done: summary.recipeKnown, total: summary.recipeTotal },
    { label: "Plans", done: summary.planKnown, total: summary.planTotal },
  ];
  const tab = str(sp.tab);

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHead title="Craft knowledge" lead={SECTION_TITLES.crafting.lead} />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        {tabs}
        <dl className="mb-4 flex flex-wrap gap-x-6 gap-y-2" aria-label="Account totals">
          {totals.map((t) => (
            <div key={t.label} className="min-w-[7rem]">
              <dt className="text-[12px] text-fg-subtle">{t.label}, account</dt>
              <dd className="text-[15px] tabular-nums text-fg">
                {t.total > 0 ? `${t.done.toLocaleString()} / ${t.total.toLocaleString()}` : "—"}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {characters.length === 0 ? (
        <Empty>Craft knowledge fills in after a logout with the addon on.</Empty>
      ) : (
        <PartyKnowledge
          characters={characters.map((c) => ({
            id: c.id,
            name: c.name,
            className: c.class,
            scanned: characterHasKnowledgeScan(c),
            research: presentResearch(c.research),
            motifs: c.motifs ?? [],
            recipes: presentRecipeLists(c.recipeLists, "provisioning").lists,
            plans: presentRecipeLists(c.recipeLists, "furnishing").lists,
            scribingCount: c.scribingScripts.length,
          }))}
          initialCharId={str(sp.char)}
          initialTab={tab && TABS.has(tab as KnowledgeTab) ? (tab as KnowledgeTab) : undefined}
        />
      )}
    </div>
  );
}
