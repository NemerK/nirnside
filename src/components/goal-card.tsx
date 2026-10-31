"use client";

import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import type { GoalCardView } from "@/lib/goals/views";
import { Badge, Card, ProgressBar } from "./ui";
import { GoalMark } from "./goal-mark";

/**
 * One target with its precomputed per-character progress matrix. All progress
 * math happens on the server; this component only renders compact rows.
 * Characters the target can never apply to (another class's line, a curse they
 * don't have) show "—" and never count as missing.
 */
export function GoalCard({
  card,
  roles,
  onDelete,
}: {
  card: GoalCardView;
  /** id → role name, for role-scope labels. */
  roles: { id: string; name: string }[];
  onDelete?: (id: string) => void;
}) {
  const { goal } = card;
  const roleName = useMemo(() => new Map(roles.map((r) => [r.id, r.name])), [roles]);
  const charName = useMemo(() => new Map(card.rows.map((r) => [r.id, r.name])), [card.rows]);

  const title = goal.domain === "skillline" ? `${goal.target} ${goal.targetRank}` : goal.target;
  const scopeLabel =
    goal.scope === "account"
      ? "Every character"
      : goal.scope === "role"
        ? `Role: ${roleName.get(goal.scopeKey ?? "") ?? "deleted role"}`
        : goal.scope === "class"
          ? `Class: ${goal.scopeKey}`
          : charName.get(goal.characterId ?? "") ?? "One character";

  return (
    <Card className="p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          {card.href ? (
            <a href={card.href} className="font-medium text-fg hover:text-accent hover:underline">
              {title}
            </a>
          ) : (
            <span className="font-medium text-fg">{title}</span>
          )}{" "}
          <Badge tone="muted">{scopeLabel}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums text-fg-muted">
            {card.done}/{card.total} done
            {card.unknown > 0 ? ` · ${card.unknown} not scanned` : ""}
            {card.notApplicable > 0 ? ` · ${card.notApplicable} n/a` : ""}
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
      <ProgressBar value={card.done} max={card.total || 1} />
      {goal.note ? <p className="mt-1.5 text-xs text-fg-subtle">{goal.note}</p> : null}
      {card.rows.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {card.rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-fg-muted">{r.name}</span>
              <span className="shrink-0">
                <GoalMark mark={r.mark} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {card.rows.length === 0 && (
        <p className="mt-2 text-xs text-fg-subtle">
          No live character matches this target — assign the role or pick another scope.
        </p>
      )}
    </Card>
  );
}