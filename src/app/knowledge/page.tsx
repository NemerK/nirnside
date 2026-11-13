import { BookOpen, RefreshCw } from "lucide-react";
import { getCharactersFull, getDataSource, hasData } from "@/lib/db/queries";
import { liveCharacters } from "@/lib/snapshot/roster";
import {
  characterHasKnowledgeScan,
  knowledgeHasAnyScan,
  presentRecipeLists,
  presentResearch,
  summarizeAccountKnowledge,
} from "@/lib/knowledge/present";
import { KnowledgeBoard, type KnowledgeTab } from "@/components/knowledge-board";
import { EmptyState, PageFrame, PageHeader } from "@/components/ui";
import { SourceBadge } from "@/components/source-badge";
import { LookSwitch } from "@/components/look-switch";
import { AtlasSection } from "@/components/atlas/section";
import { AchievementsStrip } from "@/components/achievements-strip";
import { applyRosterOrder, getRosterOrder } from "@/lib/roster/order";

export const dynamic = "force-dynamic";

const TABS = new Set<KnowledgeTab>(["research", "motifs", "recipes", "plans"]);

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const initialChar = typeof sp.char === "string" ? sp.char : undefined;
  const tabRaw = typeof sp.tab === "string" ? sp.tab : undefined;
  const initialTab = tabRaw && TABS.has(tabRaw as KnowledgeTab) ? (tabRaw as KnowledgeTab) : undefined;
  const initialQuery = typeof sp.q === "string" ? sp.q : undefined;

  const populated = safe(() => hasData()) ?? false;
  const source = safe(() => getDataSource());
  const isSample = source?.kind === "sample";
  const characters = applyRosterOrder(
    liveCharacters(safe(() => getCharactersFull()) ?? []),
    safe(() => getRosterOrder()) ?? [],
  );
  const staleAddon =
    populated && !isSample && characters.some((c) => c.lastSeen != null) && !knowledgeHasAnyScan(characters);
  const summary = summarizeAccountKnowledge(characters);

  const board = (
    <KnowledgeBoard
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
      initialCharId={initialChar}
      initialTab={initialTab}
      initialQuery={initialQuery}
    />
  );

  const body = !populated ? (
    <EmptyState title="No account data yet" icon={<BookOpen className="h-8 w-8" />}>
      Log out or <code className="rounded bg-surface-2 px-1">/reloadui</code> in ESO with the Nirnside Snapshot
      addon enabled. Motif chapters come from the Lore Library; research is the 324-trait smithing grid.
    </EmptyState>
  ) : staleAddon ? (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-amber-500/15 text-amber-500 dark:text-amber-400">
        <RefreshCw className="h-5 w-5" />
      </span>
      <div className="text-sm text-fg-muted">
        <p className="font-medium text-fg">One logout needed to fill knowledge.</p>
        <p className="mt-1 max-w-3xl">
          Your account is loaded, but this snapshot came from an older addon that did not export research,
          motifs, or recipes. The current app already installed Snapshot 0.9.28 — log each character out
          once (or <code className="rounded bg-surface-2 px-1 text-fg">/reloadui</code> on that toon).
        </p>
      </div>
    </div>
  ) : (
    board
  );

  const strip = populated && !staleAddon && (
    <div className="mb-3 shrink-0">
      <AchievementsStrip
        items={[
          { label: "Research", done: summary.researchKnown, total: summary.researchTotal },
          { label: "Motifs", done: summary.motifKnown, total: summary.motifTotal },
          { label: "Recipes", done: summary.recipeKnown, total: summary.recipeTotal },
          { label: "Plans", done: summary.planKnown, total: summary.planTotal },
        ]}
      />
      <p className="mt-1.5 text-xs text-fg-subtle">
        Account totals. Open a character for the trait grid, chapters, recipes, and plans.
      </p>
    </div>
  );

  return (
    <LookSwitch
      classic={
        <PageFrame>
          <PageHeader
            title="Knowledge"
            subtitle="Research, motifs, recipes, and furnishing plans from the last logout."
            action={<SourceBadge source={populated && !isSample ? "ingame" : "reference"} />}
          />
          {strip}
          {body}
        </PageFrame>
      }
      atlas={
        <AtlasSection
          grain="Characters"
          title="Craft knowledge"
          compact
          action={<SourceBadge source={populated && !isSample ? "ingame" : "reference"} />}
        >
          {strip}
          {body}
        </AtlasSection>
      }
    />
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
