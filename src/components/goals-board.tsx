"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { GoalCardView, GoalRowItem } from "@/lib/goals/views";
import { TIERS, TIER_LABEL, skillLineTitle, type SkillLineChoice } from "@/lib/goals/types";
import { Badge, Card, SectionTitle } from "./ui";
import { AddGoalButton } from "./goal-editor";
import { GoalCard } from "./goal-card";
import { GoalMark } from "./goal-mark";

const TIER_TONE: Record<string, "accent" | "muted" | "ok"> = {
  essential: "accent",
  optional: "muted",
  completionist: "ok",
};

/** The Home "Targets" board: every planned target with its account progress. */
export function GoalsBoard({
  cards,
  roles,
}: {
  cards: GoalCardView[];
  roles: { id: string; name: string }[];
}) {
  const router = useRouter();

  if (cards.length === 0) {
    return (
      <section className="mb-8">
        <SectionTitle>Targets</SectionTitle>
        <Card className="px-5 py-8 text-center text-sm text-fg-muted">
          Nothing planned yet. Open the{" "}
          <Link href="/planner" className="text-accent hover:underline">
            Planner
          </Link>{" "}
          to set account-wide essentials — Assault 7 for everyone, weapon and armor lines to 50, exact abilities per
          role — and watch each character tick off.
        </Card>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionTitle className="mb-0">Targets</SectionTitle>
        <Link href="/planner" className="text-xs text-accent hover:underline">
          Plan in the Planner →
        </Link>
      </div>
      <div className="space-y-4">
        {TIERS.map((tier) => {
          const tierCards = cards.filter((c) => c.goal.tier === tier);
          if (tierCards.length === 0) return null;
          return (
            <div key={tier}>
              <div className="mb-2 flex items-center gap-2">
                <Badge tone={TIER_TONE[tier]}>{TIER_LABEL[tier]}</Badge>
                <span className="text-xs text-fg-subtle">
                  {tierCards.length} target{tierCards.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-3">
                {tierCards.map((card) => (
                  <GoalCard
                    key={card.goal.id}
                    card={card}
                    roles={roles}
                    onDelete={async (id) => {
                      await fetch(`/api/goals/${encodeURIComponent(id)}`, { method: "DELETE" });
                      router.refresh();
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** One character's view: every target that applies to them, with live progress. */
export function CharacterGoals({
  rows,
  lines,
  subjectId,
  subjectName,
}: {
  rows: GoalRowItem[];
  lines: SkillLineChoice[];
  subjectId: string;
  subjectName: string;
}) {
  const router = useRouter();

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionTitle className="mb-0">Targets</SectionTitle>
        <div className="flex items-center gap-2">
          <Link href="/planner" className="text-xs text-accent hover:underline">
            Planner →
          </Link>
          <AddGoalButton
            lines={lines}
            defaultScope="character"
            characterId={subjectId}
            allowAccount
            label="Quick add"
          />
        </div>
      </div>
      {rows.length === 0 ? (
        <Card className="px-4 py-6 text-sm text-fg-muted">
          No targets apply to {subjectName} yet. Open the{" "}
          <Link href="/planner" className="text-accent hover:underline">
            Planner
          </Link>{" "}
          to set them.
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {rows.map((row) => (
            <GoalRow
              key={row.goal.id}
              row={row}
              onDelete={async () => {
                await fetch(`/api/goals/${encodeURIComponent(row.goal.id)}`, { method: "DELETE" });
                router.refresh();
              }}
            />
          ))}
        </Card>
      )}
    </section>
  );
}

function GoalRow({ row, onDelete }: { row: GoalRowItem; onDelete: () => void }) {
  const { goal } = row;
  const title = goal.domain === "skillline" ? skillLineTitle(goal) : goal.target;
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {row.href ? (
            <Link href={row.href} className="text-sm font-medium text-fg hover:text-accent hover:underline">
              {title}
            </Link>
          ) : (
            <span className="text-sm font-medium text-fg">{title}</span>
          )}
          <Badge tone={TIER_TONE[goal.tier]}>{TIER_LABEL[goal.tier]}</Badge>
        </div>
        {goal.note ? <p className="mt-0.5 text-xs text-fg-subtle">{goal.note}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <GoalMark mark={row.mark} />
        {row.deletable && (
          <button
            type="button"
            aria-label={`Delete ${title}`}
            onClick={onDelete}
            className="rounded p-1 text-fg-subtle hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}