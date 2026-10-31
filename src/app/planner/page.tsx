import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { loadPlannerData } from "@/lib/planner/data";
import { listGoals } from "@/lib/db/goals";
import { getAccount } from "@/lib/db/queries";
import { EmptyState, PageHeader } from "@/components/ui";
import { LoadDemoButton } from "@/components/demo-controls";
import { PlannerBoard } from "@/components/planner-board";

export const dynamic = "force-dynamic";

export default function PlannerPage() {
  const account = safe(getAccount);
  const data = safe(loadPlannerData);

  if (!account || !data || data.subjects.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader
          title="Planner"
          subtitle="Set targets for the account, a role, a class, or one character — then track who is done."
        />
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
      </div>
    );
  }

  const goals = safe(listGoals) ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Planner"
        subtitle="Set what every character, role, or class must have — essential first, optional and completionist after. Progress reads straight from your last snapshot; nothing is guessed."
      />
      <PlannerBoard data={data} goals={goals} />
    </div>
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
