import { PageHead } from "@/components/party/page-head";
import { TargetsBoard } from "@/components/targets/targets-board";
import type { TargetPerson } from "@/components/targets/target-sheet";
import { listGoals } from "@/lib/db/goals";
import { listRoles } from "@/lib/db/roles";
import { goalCardsForClient, loadPlannerData, type PlannerData } from "@/lib/planner/data";
import { reviewTargets } from "@/lib/goals/review";
import { compareLines, lightSubjects, roster, targetChoices } from "@/lib/party/data";
import { applyRosterOrder, getRosterOrder } from "@/lib/roster/order";

export const dynamic = "force-dynamic";

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/**
 * Every target, once, with who is still short. Skill-line targets are judged
 * from line ranks alone; full snapshots are read only when an ability or
 * script target needs them.
 */
export default function TargetsPage() {
  const goals = safe(() => listGoals(), []);
  const roles = safe(() => listRoles(), []).map((r) => ({ id: r.id, name: r.name }));
  const characters = roster();
  const { lines, lineIndex } = compareLines(characters);
  const needsFull = goals.some((g) => g.domain !== "skillline");

  let data: Pick<PlannerData, "subjects" | "lineIndex" | "abilityIndex">;
  if (needsFull) {
    const full = safe(() => loadPlannerData(), null);
    data = full
      ? { subjects: applyRosterOrder(full.subjects, safe(() => getRosterOrder(), [])), lineIndex: full.lineIndex, abilityIndex: full.abilityIndex }
      : { subjects: lightSubjects(), lineIndex, abilityIndex: [] };
  } else {
    data = { subjects: lightSubjects(), lineIndex, abilityIndex: [] };
  }

  const cards = goalCardsForClient(goals, data as PlannerData);
  const groups = reviewTargets({ goals, cards, subjects: data.subjects, roles });
  const people: TargetPerson[] = data.subjects.map((s) => ({
    id: s.id,
    name: s.name,
    className: s.className,
    roleIds: s.roleIds,
  }));

  return (
    <div className="mx-auto w-full max-w-[1320px]">
      <PageHead
        title="Targets"
        lead="What you're working towards, and who is still short. A target for one character or class replaces a broader one for them."
      />
      <TargetsBoard groups={groups} goals={goals} people={people} roles={roles} choices={targetChoices(lines)} />
    </div>
  );
}
