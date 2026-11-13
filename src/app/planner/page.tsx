import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { loadPlannerData, goalCardsForClient } from "@/lib/planner/data";
import { listGoals } from "@/lib/db/goals";
import { getSkillLineByName } from "@/lib/db/catalog-queries";
import { getAccount } from "@/lib/db/queries";
import type { Goal } from "@/lib/goals/types";
import { EmptyState, PageHeader } from "@/components/ui";
import { LoadDemoButton } from "@/components/demo-controls";
import { PlannerBoard, type PlannerChoices } from "@/components/planner-board";
import { LookSwitch } from "@/components/look-switch";
import { AtlasSection } from "@/components/atlas/section";

export const dynamic = "force-dynamic";

function lineHref(goal: Goal): string | undefined {
  if (goal.domain !== "skillline") return undefined;
  try {
    const row = getSkillLineByName(goal.target);
    return row ? `/encyclopedia/skills/${encodeURIComponent(row.entry.id)}` : undefined;
  } catch {
    return undefined;
  }
}

export default function PlannerPage() {
  const account = safe(getAccount);
  const data = safe(loadPlannerData);

  if (!account || !data || data.subjects.length === 0) {
    const empty = (
      <EmptyState title="No characters yet" icon={<ClipboardList className="h-8 w-8" />}>
        <p className="mb-4">
          The planner works from your ESO snapshots. Import your account first — point Nirnside at your ESO folder
          and log out once in game.
        </p>
        <div className="flex flex-col items-center gap-2">
          <Link
            href="/setup"
            className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-accent-fg"
          >
            Open Setup
          </Link>
          <LoadDemoButton />
        </div>
      </EmptyState>
    );
    return (
      <LookSwitch
        classic={
          <div className="mx-auto w-full max-w-3xl">
            <PageHeader
              title="Planner"
              subtitle="Set targets for the account, a role, a class, or one character — then track who is done."
            />
            {empty}
          </div>
        }
        atlas={
          <AtlasSection
            title="Planner"
            subtitle="Player-authored targets on top of the snapshot — the only place goals are created."
          >
            {empty}
          </AtlasSection>
        }
      />
    );
  }

  const goals = safe(listGoals) ?? [];
  const cards = goalCardsForClient(goals, data, lineHref);
  const choices: PlannerChoices = {
    lines: data.lines,
    scripts: data.scripts,
    abilities: data.abilities,
    abilityRows: data.abilityRows,
    roles: data.roles,
    classes: data.classes,
    characters: data.subjects.map((s) => ({
      id: s.id,
      name: s.name,
      className: s.className,
      ranks: s.skillLines.map((l) => ({ name: l.name, rank: l.rank })),
    })),
  };

  const board = <PlannerBoard choices={choices} cards={cards} />;

  return (
    <LookSwitch
      classic={
        <div className="mx-auto w-full max-w-6xl">
          <PageHeader
            title="Planner"
            subtitle="Choose Skills, Abilities, or Scribing. Skill lines stay closed until you open them."
          />
          {board}
        </div>
      }
      atlas={
        <AtlasSection
          title="Planner"
          subtitle="Author essential, optional, and completionist targets. Home and the roster only show progress."
        >
          {board}
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
