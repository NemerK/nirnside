"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { Goal, GoalSubject, SkillLineChoice } from "@/lib/goals/types";
import { TIERS, TIER_LABEL } from "@/lib/goals/types";
import { goalAppliesTo, goalProgress } from "@/lib/goals/progress";
import { Badge, Card, SectionTitle } from "./ui";
import { AddGoalButton } from "./goal-editor";
import { GoalCard, useGoalIndexes, type IndexArrays } from "./goal-card";
import { GoalMark } from "./goal-mark";

const TIER_TONE: Record<string, "accent" | "muted" | "ok"> = {
  essential: "accent",
  optional: "muted",
  completionist: "ok",
};

/** The Home "Targets" board: every planned target with its account progress. */
export function GoalsBoard({
  goals,
  live,
  indexes,
  roles,
  hrefForLine,
}: {
  goals: Goal[];
  live: GoalSubject[];
  indexes: IndexArrays;
  roles: { id: string; name: string }[];
  hrefForLine: Record<string, string>;
}) {
  const router = useRouter();

  if (goals.length === 0) {
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
          const tierGoals = goals.filter((g) => g.tier === tier);
          if (tierGoals.length === 0) return null;
          return (
            <div key={tier}>
              <div className="mb-2 flex items-center gap-2">
                <Badge tone={TIER_TONE[tier]}>{TIER_LABEL[tier]}</Badge>
                <span className="text-xs text-fg-subtle">
                  {tierGoals.length} target{tierGoals.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="space-y-3">
                {tierGoals.map((goal) => (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    subjects={live}
                    indexes={indexes}
                    roles={roles}
                    href={goal.domain === "skillline" ? hrefForLine[goal.target.toLowerCase()] : undefined}
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
  goals,
  subject,
  lines,
  hrefForLine,
  indexes,
  roles,
}: {
  goals: Goal[];
  subject: GoalSubject;
  lines: SkillLineChoice[];
  hrefForLine: Record<string, string>;
  indexes: IndexArrays;
  roles: { id: string; name: string }[];
}) {
  const router = useRouter();
  const built = useGoalIndexes(indexes);
  const roleName = new Map(roles.map((r) => [r.id, r.name]));

  const inherited = goals.filter((g) => g.scope !== "character" && goalAppliesTo(g, subject));
  const personal = goals.filter((g) => g.scope === "character" && g.characterId === subject.id);

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
            characterId={subject.id}
            allowAccount
            label="Quick add"
          />
        </div>
      </div>
      {inherited.length === 0 && personal.length === 0 ? (
        <Card className="px-4 py-6 text-sm text-fg-muted">
          No targets apply to this character yet. Open the{" "}
          <Link href="/planner" className="text-accent hover:underline">
            Planner
          </Link>{" "}
          to set them.
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {[...inherited, ...personal].map((g) => (
            <GoalRow
              key={g.id}
              goal={g}
              subject={subject}
              built={built}
              roleName={roleName}
              href={g.domain === "skillline" ? hrefForLine[g.target.toLowerCase()] : undefined}
              deletable={g.scope === "character"}
              onDelete={async () => {
                await fetch(`/api/goals/${encodeURIComponent(g.id)}`, { method: "DELETE" });
                router.refresh();
              }}
            />
          ))}
        </Card>
      )}
    </section>
  );
}

function GoalRow({
  goal,
  subject,
  built,
  roleName,
  href,
  deletable,
  onDelete,
}: {
  goal: Goal;
  subject: GoalSubject;
  built: ReturnType<typeof useGoalIndexes>;
  roleName: Map<string, string>;
  href?: string;
  deletable: boolean;
  onDelete: () => void;
}) {
  const title = goal.domain === "skillline" ? `${goal.target} ${goal.targetRank}` : goal.target;
  const scopeLabel =
    goal.scope === "account"
      ? "Account"
      : goal.scope === "role"
        ? `Role: ${roleName.get(goal.scopeKey ?? "") ?? "deleted role"}`
        : goal.scope === "class"
          ? `Class: ${goal.scopeKey}`
          : "Personal";
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {href ? (
            <Link href={href} className="text-sm font-medium text-fg hover:text-accent hover:underline">
              {title}
            </Link>
          ) : (
            <span className="text-sm font-medium text-fg">{title}</span>
          )}
          <Badge tone="muted">{scopeLabel}</Badge>
          <Badge tone={TIER_TONE[goal.tier]}>{TIER_LABEL[goal.tier]}</Badge>
        </div>
        {goal.note ? <p className="mt-0.5 text-xs text-fg-subtle">{goal.note}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <GoalMark progress={goalProgress(goal, subject, built)} goal={goal} />
        {deletable && (
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