"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Minus, Trash2 } from "lucide-react";
import type { Goal, GoalSubject, LineProgress, SkillLineChoice } from "@/lib/goals/types";
import { progressLabel, skillLineProgress, summarizeAccountGoal } from "@/lib/goals/progress";
import { Badge, Card, ProgressBar, SectionTitle } from "./ui";
import { AddGoalButton } from "./goal-editor";

export function GoalsBoard({
  goals,
  live,
  roster,
  lines,
  hrefForLine,
}: {
  goals: Goal[];
  live: GoalSubject[];
  roster?: GoalSubject[];
  lines: SkillLineChoice[];
  hrefForLine: Record<string, string>;
}) {
  const account = goals.filter((g) => g.scope === "account");
  const personal = goals.filter((g) => g.scope === "character");
  const known = roster ?? live;
  const nameById = new Map(known.map((c) => [c.id, c.name]));

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionTitle className="mb-0">Goals</SectionTitle>
        <AddGoalButton lines={lines} defaultScope="account" label="Account goal" />
      </div>
      {goals.length === 0 ? (
        <Card className="px-5 py-8 text-center text-sm text-fg-muted">
          Set an account-wide target (Assault 7 on every toon) or open a character and add a personal one (Werewolf
          10). Progress is the skill line rank from the last snapshot — nothing is guessed.
        </Card>
      ) : (
        <div className="space-y-3">
          {account.map((g) => (
            <AccountGoalCard key={g.id} goal={g} live={live} href={hrefForLine[g.lineName.toLowerCase()]} />
          ))}
          {personal.map((g) => {
            const subject = known.find((c) => c.id === g.characterId);
            const progress = subject
              ? skillLineProgress(subject, g.lineName, g.targetRank)
              : ({ state: "unknown" } as LineProgress);
            return (
              <GoalCard
                key={g.id}
                goal={g}
                href={hrefForLine[g.lineName.toLowerCase()]}
                subtitle={nameById.get(g.characterId ?? "") ?? "Unknown character"}
                characterHref={g.characterId ? `/characters/${encodeURIComponent(g.characterId)}` : undefined}
                progress={progress}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function AccountGoalCard({
  goal,
  live,
  href,
}: {
  goal: Goal;
  live: GoalSubject[];
  href?: string;
}) {
  const summary = summarizeAccountGoal(goal, live);
  return (
    <Card className="p-4">
      <GoalHeader goal={goal} href={href} badge="Every character" />
      {goal.note ? <p className="mt-1 text-xs text-fg-subtle">{goal.note}</p> : null}
      <div className="mt-3">
        <div className="mb-1 flex items-baseline justify-between text-xs text-fg-muted">
          <span>
            {summary.done}/{summary.total} at rank {goal.targetRank}
            {summary.unknown > 0 ? ` · ${summary.unknown} not scanned` : ""}
          </span>
        </div>
        <ProgressBar value={summary.done} max={summary.total || 1} />
      </div>
      {summary.rows.length > 0 && (
        <ul className="mt-3 divide-y divide-border/60">
          {summary.rows.map((r) => (
            <li key={r.character.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <Link
                href={`/characters/${encodeURIComponent(r.character.id)}`}
                className="truncate text-fg hover:text-accent hover:underline"
              >
                {r.character.name}
              </Link>
              <ProgressMark progress={r.progress} targetRank={goal.targetRank} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function GoalCard({
  goal,
  href,
  subtitle,
  characterHref,
  progress,
}: {
  goal: Goal;
  href?: string;
  subtitle: string;
  characterHref?: string;
  progress: LineProgress;
}) {
  return (
    <Card className="p-4">
      <GoalHeader goal={goal} href={href} badge="One character" />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-sm">
        {characterHref ? (
          <Link href={characterHref} className="text-fg-muted hover:text-accent hover:underline">
            {subtitle}
          </Link>
        ) : (
          <span className="text-fg-muted">{subtitle}</span>
        )}
        <ProgressMark progress={progress} targetRank={goal.targetRank} />
      </div>
      {goal.note ? <p className="mt-1 text-xs text-fg-subtle">{goal.note}</p> : null}
    </Card>
  );
}

function GoalHeader({
  goal,
  href,
  badge,
}: {
  goal: Goal;
  href?: string;
  badge: string;
}) {
  const router = useRouter();
  const title = `${goal.lineName} ${goal.targetRank}`;
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {href ? (
            <Link href={href} className="font-medium text-fg hover:text-accent hover:underline">
              {title}
            </Link>
          ) : (
            <span className="font-medium text-fg">{title}</span>
          )}
          <Badge tone="muted">{badge}</Badge>
        </div>
      </div>
      <button
        type="button"
        aria-label={`Delete ${title}`}
        onClick={async () => {
          await fetch(`/api/goals/${encodeURIComponent(goal.id)}`, { method: "DELETE" });
          router.refresh();
        }}
        className="rounded p-1 text-fg-subtle hover:text-danger"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ProgressMark({ progress, targetRank }: { progress: LineProgress; targetRank: number }) {
  const label = progressLabel(progress, targetRank);
  if (progress.state === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-accent">
        <Check className="h-3.5 w-3.5" /> {label}
      </span>
    );
  }
  if (progress.state === "short") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-fg-muted">
        <Minus className="h-3.5 w-3.5" /> {label}
      </span>
    );
  }
  return <span className="text-xs text-fg-subtle">{label}</span>;
}

export function CharacterGoals({
  goals,
  subject,
  lines,
  hrefForLine,
}: {
  goals: Goal[];
  subject: GoalSubject;
  lines: SkillLineChoice[];
  hrefForLine: Record<string, string>;
}) {
  const inherited = goals.filter((g) => g.scope === "account");
  const personal = goals.filter((g) => g.scope === "character" && g.characterId === subject.id);
  const router = useRouter();

  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <SectionTitle className="mb-0">Goals</SectionTitle>
        <AddGoalButton
          lines={lines}
          defaultScope="character"
          characterId={subject.id}
          allowAccount
          label="Add goal"
        />
      </div>
      {inherited.length === 0 && personal.length === 0 ? (
        <Card className="px-4 py-6 text-sm text-fg-muted">
          No goals yet. Add one for this character, or an account-wide target that applies to every toon.
        </Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {inherited.map((g) => {
            const p = skillLineProgress(subject, g.lineName, g.targetRank);
            return (
              <GoalRow
                key={g.id}
                goal={g}
                progress={p}
                href={hrefForLine[g.lineName.toLowerCase()]}
                tag="Account"
              />
            );
          })}
          {personal.map((g) => {
            const p = skillLineProgress(subject, g.lineName, g.targetRank);
            return (
              <GoalRow
                key={g.id}
                goal={g}
                progress={p}
                href={hrefForLine[g.lineName.toLowerCase()]}
                tag="Personal"
                onDelete={async () => {
                  await fetch(`/api/goals/${encodeURIComponent(g.id)}`, { method: "DELETE" });
                  router.refresh();
                }}
              />
            );
          })}
        </Card>
      )}
    </section>
  );
}

function GoalRow({
  goal,
  progress,
  href,
  tag,
  onDelete,
}: {
  goal: Goal;
  progress: LineProgress;
  href?: string;
  tag: string;
  onDelete?: () => void;
}) {
  const title = `${goal.lineName} ${goal.targetRank}`;
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
          <Badge tone="muted">{tag}</Badge>
        </div>
        {goal.note ? <p className="mt-0.5 text-xs text-fg-subtle">{goal.note}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ProgressMark progress={progress} targetRank={goal.targetRank} />
        {onDelete && (
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
