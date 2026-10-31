"use client";

import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import type { AbilityMeta, Goal, GoalIndexes, GoalSubject, LineMeta } from "@/lib/goals/types";
import { goalAppliesTo, goalProgress, summarizeGoal } from "@/lib/goals/progress";
import { Badge, Card, ProgressBar } from "./ui";
import { GoalMark } from "./goal-mark";

/** Index arrays cross the server/client boundary; Maps are rebuilt on the client. */
export interface IndexArrays {
  lineIndex?: [string, LineMeta][];
  abilityIndex?: [string, AbilityMeta][];
}

export function useGoalIndexes(arrays?: IndexArrays): GoalIndexes {
  const lineIndex = arrays?.lineIndex;
  const abilityIndex = arrays?.abilityIndex;
  return useMemo(
    () => ({
      lines: lineIndex ? new Map(lineIndex) : undefined,
      abilities: abilityIndex ? new Map(abilityIndex) : undefined,
    }),
    [lineIndex, abilityIndex],
  );
}

/**
 * One target with its per-character progress matrix. Shared by the Planner and
 * the Home board. Characters the target can never apply to (another class's
 * line, a curse they don't have) show "—" and never count as missing.
 */
export function GoalCard({
  goal,
  subjects,
  indexes,
  roles,
  href,
  onDelete,
}: {
  goal: Goal;
  subjects: GoalSubject[];
  indexes: IndexArrays;
  /** id → role name, for role-scope labels. */
  roles: { id: string; name: string }[];
  href?: string;
  onDelete?: (id: string) => void;
}) {
  const built = useGoalIndexes(indexes);
  const roleName = useMemo(() => new Map(roles.map((r) => [r.id, r.name])), [roles]);
  const charName = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects]);
  const summary = summarizeGoal(goal, subjects, built);

  const title = goal.domain === "skillline" ? `${goal.target} ${goal.targetRank}` : goal.target;
  const scopeLabel =
    goal.scope === "account"
      ? "Every character"
      : goal.scope === "role"
        ? `Role: ${roleName.get(goal.scopeKey ?? "") ?? "deleted role"}`
        : goal.scope === "class"
          ? `Class: ${goal.scopeKey}`
          : charName.get(goal.characterId ?? "") ?? "One character";
  const rows = summary.rows.filter((r) => goalAppliesTo(goal, r.character));

  return (
    <Card className="p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {href ? (
            <a href={href} className="font-medium text-fg hover:text-accent hover:underline">
              {title}
            </a>
          ) : (
            <span className="font-medium text-fg">{title}</span>
          )}{" "}
          <Badge tone="muted">{scopeLabel}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-fg-muted">
            {summary.done}/{summary.total} done
            {summary.unknown > 0 ? ` · ${summary.unknown} not scanned` : ""}
            {summary.notApplicable > 0 ? ` · ${summary.notApplicable} n/a` : ""}
          </span>
          {onDelete && (
            <button
              type="button"
              aria-label={`Delete ${title}`}
              onClick={() => onDelete(goal.id)}
              className="rounded p-1 text-fg-subtle hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <ProgressBar value={summary.done} max={summary.total || 1} />
      {goal.note ? <p className="mt-1.5 text-xs text-fg-subtle">{goal.note}</p> : null}
      {rows.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.character.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-fg-muted">{r.character.name}</span>
              <span className="shrink-0">
                <GoalMark progress={goalProgress(goal, r.character, built)} goal={goal} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {rows.length === 0 && (
        <p className="mt-2 text-xs text-fg-subtle">
          No live character matches this target — assign the role or pick another scope.
        </p>
      )}
    </Card>
  );
}