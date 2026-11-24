import { Users } from "lucide-react";
import { getCharactersFull } from "@/lib/db/queries";
import { listGoals } from "@/lib/db/goals";
import { buildGoalIndexes } from "@/lib/planner/data";
import { liveCharacters } from "@/lib/snapshot/roster";
import { presentCharacterWorkspaceCards } from "@/lib/characters/workspace";
import { accountMotifProgress } from "@/lib/knowledge/present";
import { applyRosterOrder, getRosterOrder } from "@/lib/roster/order";
import type { GoalIndexes } from "@/lib/goals/types";
import { LookSwitch } from "@/components/look-switch";
import { ProgressBoard } from "@/components/progress-board";
import { AtlasEmpty, AtlasPage } from "@/components/atlas/ui";
import { EmptyState, PageFrame, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const SUBTITLE =
  "The percentage is mandatory goals only. Extra ranks, optional goals, and motifs stay visible and do not move it.";

export default async function ProgressPage() {
  const goals = safe(() => listGoals()) ?? [];
  const indexArrays = safe(() => buildGoalIndexes());
  const indexes: GoalIndexes = {
    lines: new Map(indexArrays?.lineIndex ?? []),
    abilities: new Map(indexArrays?.abilityIndex ?? []),
  };
  const characters = liveCharacters(safe(() => getCharactersFull()) ?? []);
  const cards = applyRosterOrder(
    presentCharacterWorkspaceCards(characters, goals, indexes),
    safe(() => getRosterOrder()) ?? [],
  );
  const motifs = accountMotifProgress(characters);
  const board = cards.length > 0 ? <ProgressBoard cards={cards} motifs={motifs} /> : null;

  return (
    <LookSwitch
      classic={
        <PageFrame>
          <PageHeader title="Progress" subtitle={SUBTITLE} />
          {board ?? (
            <EmptyState title="No characters yet" icon={<Users className="h-8 w-8" />}>
              Install the addon, log a character out or <code className="rounded bg-surface-2 px-1">/reloadui</code>,
              then import.
            </EmptyState>
          )}
        </PageFrame>
      }
      atlas={
        <AtlasPage title="Progress" subtitle={SUBTITLE}>
          {board ?? (
            <AtlasEmpty title="No characters yet">
              Install the addon, log a character out or{" "}
              <code className="rounded bg-surface-2 px-1">/reloadui</code>, then import.
            </AtlasEmpty>
          )}
        </AtlasPage>
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
