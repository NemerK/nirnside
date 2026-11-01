import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { getCharactersFull, getAccount } from "@/lib/db/queries";
import { liveCharacters } from "@/lib/snapshot/roster";
import { listRoles, listAssignments } from "@/lib/db/roles";
import { listGoals } from "@/lib/db/goals";
import { loadPlannerData } from "@/lib/planner/data";
import { goalAppliesTo, goalProgress } from "@/lib/goals/progress";
import type { Goal, GoalSubject } from "@/lib/goals/types";
import { presentResearch } from "@/lib/knowledge/present";
import { EmptyState, Card, PageHeader } from "@/components/ui";
import { LoadDemoButton } from "@/components/demo-controls";
import { DashboardCard, type DashboardCardData, type DashboardRow } from "@/components/dashboard-card";

export const dynamic = "force-dynamic";

interface Tally {
  done: number;
  total: number;
}

function domainTallies(goals: Goal[], subject: GoalSubject, indexes: Parameters<typeof goalProgress>[2]) {
  const byDomain = new Map<Goal["domain"], Tally>();
  let overallDone = 0;
  let overallTotal = 0;
  for (const goal of goals) {
    if (!goalAppliesTo(goal, subject)) continue;
    const progress = goalProgress(goal, subject, indexes);
    if (progress.state === "notapplicable") continue;
    const t = byDomain.get(goal.domain) ?? { done: 0, total: 0 };
    t.total += 1;
    overallTotal += 1;
    if (progress.state === "done") {
      t.done += 1;
      overallDone += 1;
    }
    byDomain.set(goal.domain, t);
  }
  return { byDomain, overallDone, overallTotal };
}

const pct = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const sort = sp.sort === "roster" ? "roster" : "progress";
  const account = safe(getAccount);
  const data = safe(loadPlannerData);

  if (!account || !data || data.subjects.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader
          title="Dashboard"
          subtitle="Every character's progress against your targets — completion at a glance."
        />
        <EmptyState title="No characters yet" icon={<LayoutDashboard className="h-8 w-8" />}>
          <p className="mb-4">
            The dashboard works from your ESO snapshots. Import your account first — point Nirnside at your ESO folder
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
  const full = liveCharacters(safe(getCharactersFull) ?? []);
  const indexes = {
    lines: new Map(data.lineIndex),
    abilities: new Map(data.abilityIndex),
  };
  const roleRows = safe(listRoles) ?? [];
  const assignments = safe(listAssignments) ?? {};
  const lineByName = new Map(data.lines.map((l) => [l.name.toLowerCase(), l]));

  const cards: DashboardCardData[] = data.subjects.map((subject) => {
    const fullChar = full.find((c) => c.id === subject.id);
    const roleIds = assignments[subject.id] ?? [];
    const { byDomain, overallDone, overallTotal } = domainTallies(goals, subject, indexes);

    const rows: DashboardRow[] = [];
    for (const domain of ["skillline", "ability", "script"] as const) {
      const t = byDomain.get(domain);
      if (!t || t.total === 0) continue;
      rows.push({
        label: domain === "skillline" ? "Skill line targets" : domain === "ability" ? "Ability targets" : "Script targets",
        pct: pct(t.done, t.total),
        detail: `${t.done}/${t.total}`,
        href: "/planner",
      });
    }

    // General progress, targets or not — the things a player grinds.
    if (data.scripts.length > 0 && subject.lastSeen != null) {
      rows.push({
        label: "Scribing scripts known",
        pct: pct(subject.scribingScripts.length, data.scripts.length),
        detail: `${subject.scribingScripts.length}/${data.scripts.length}`,
        href: `/focus?char=${encodeURIComponent(subject.id)}`,
      });
    }
    if (fullChar) {
      const research = presentResearch(fullChar.research);
      if (research.total > 0) {
        rows.push({
          label: "Trait research",
          pct: pct(research.known, research.total),
          detail: `${research.known}/${research.total}`,
          href: `/focus?char=${encodeURIComponent(subject.id)}`,
        });
      }
    }
    // Skill levels against the live caps (known caps only — never guessed).
    let rankSum = 0;
    let capSum = 0;
    for (const line of subject.skillLines) {
      const cap = lineByName.get(line.name.toLowerCase())?.maxRank;
      if (!cap) continue;
      rankSum += Math.min(line.rank, cap);
      capSum += cap;
    }
    if (capSum > 0) {
      rows.push({
        label: "Skill levels (vs caps)",
        pct: pct(rankSum, capSum),
        detail: `${Math.round(pct(rankSum, capSum))}% of cap`,
        href: `/focus?char=${encodeURIComponent(subject.id)}`,
      });
    }

    const level = fullChar?.level ?? 1;
    const cp = fullChar?.championPoints ?? 0;
    return {
      id: subject.id,
      name: subject.name,
      className: subject.className,
      levelLabel: level >= 50 ? `${cp.toLocaleString("en-US")}` : `${level}`,
      levelCaption: level >= 50 ? "CP" : "level",
      scanned: !!subject.lastSeen,
      roles: roleIds
        .map((id) => roleRows.find((r) => r.id === id)?.name)
        .filter((n): n is string => !!n),
      overall:
        overallTotal > 0
          ? { pct: pct(overallDone, overallTotal), done: overallDone, total: overallTotal }
          : null,
      rows,
    };
  });

  cards.sort((a, b) =>
    sort === "roster"
      ? 0 // subjects already come in roster order
      : (b.overall?.pct ?? -1) - (a.overall?.pct ?? -1) || a.name.localeCompare(b.name),
  );

  const accountTotal = goals.length;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Dashboard"
        subtitle="Every character's progress against your targets — skills, scribing, research, completion at a glance."
        action={
          <div className="inline-flex gap-0.5 rounded-lg border border-border bg-surface p-0.5">
            {(
              [
                ["progress", "Most progress"],
                ["roster", "Roster order"],
              ] as const
            ).map(([key, label]) => (
              <Link
                key={key}
                href={`/dashboard?sort=${key}`}
                className={`rounded-md px-2.5 py-1.5 text-xs ${
                  sort === key ? "bg-accent-soft font-medium text-accent" : "text-fg-muted hover:text-fg"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        }
      />

      {accountTotal === 0 && (
        <Card className="mb-4 px-4 py-3 text-sm text-fg-muted">
          No targets yet, so the rings are quiet — the cards still show scribing, research, and skill-level progress.{" "}
          <Link href="/planner" className="text-accent hover:underline">
            Set targets in the Planner
          </Link>{" "}
          and the rings fill in.
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((char) => (
          <DashboardCard key={char.id} char={char} />
        ))}
      </div>
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
