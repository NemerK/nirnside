import Link from "next/link";
import type { ReactNode } from "react";
import { LayoutDashboard } from "lucide-react";
import { getCharactersFull, getAccount } from "@/lib/db/queries";
import { liveCharacters } from "@/lib/snapshot/roster";
import { listRoles, listAssignments } from "@/lib/db/roles";
import { listGoals } from "@/lib/db/goals";
import { catalogAbilityLoreFor, getScripts, getSkillLineByName } from "@/lib/db/catalog-queries";
import { buildGoalIndexes, characterGoalRows, loadPlannerData, skillLineChoices } from "@/lib/planner/data";
import { goalAppliesTo, goalProgress, toGoalSubject } from "@/lib/goals/progress";
import type { Goal, GoalSubject } from "@/lib/goals/types";
import { presentMotifs, presentResearch } from "@/lib/knowledge/present";
import { presentSkillBook } from "@/lib/skills/present";
import type { Character } from "@/lib/snapshot/schema";
import { dashboardHref, isDashboardSection, isTargetDomain, type DashboardSection } from "@/lib/dashboard/href";
import { EmptyState, Card, PageHeader } from "@/components/ui";
import { LoadDemoButton } from "@/components/demo-controls";
import { DashboardCard, type DashboardCardData, type DashboardRow } from "@/components/dashboard-card";
import { DashboardDetail } from "@/components/dashboard-detail";
import { SkillBook } from "@/components/skill-book";
import { CharacterGoals } from "@/components/goals-board";
import {
  ChampionPanel,
  CraftingPanel,
  KnowledgePanel,
  ScribingPanel,
  type FocusScript,
} from "@/components/focus-panels";
import { LookSwitch } from "@/components/look-switch";
import { AtlasSection } from "@/components/atlas/section";

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
  const requestedChar = typeof sp.char === "string" ? sp.char : "";
  const sectionParam = typeof sp.section === "string" ? sp.section : undefined;
  const domainParam = typeof sp.domain === "string" ? sp.domain : undefined;
  const requestedSection: DashboardSection = isDashboardSection(sectionParam) ? sectionParam : "skills";
  const requestedDomain =
    requestedSection === "targets" && isTargetDomain(domainParam) ? domainParam : null;
  const account = safe(getAccount);
  const data = safe(loadPlannerData);

  if (!account || !data || data.subjects.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader
          title="Dashboard"
          subtitle="Every character at a glance. Select a name or a bar to open that progress."
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
        section: "targets",
        domain,
      });
    }

    // General progress, targets or not — the things a player grinds.
    if (data.scripts.length > 0 && subject.lastSeen != null) {
      rows.push({
        label: "Scribing scripts known",
        pct: pct(subject.scribingScripts.length, data.scripts.length),
        detail: `${subject.scribingScripts.length}/${data.scripts.length}`,
        section: "scribing",
      });
    }
    if (fullChar) {
      const research = presentResearch(fullChar.research);
      if (research.total > 0) {
        rows.push({
          label: "Trait research",
          pct: pct(research.known, research.total),
          detail: `${research.known}/${research.total}`,
          section: "crafting",
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
        section: "skills",
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
  const selected = full.find((c) => c.id === requestedChar) ?? null;
  const selectedCard = selected ? cards.find((c) => c.id === selected.id) ?? null : null;
  const section: DashboardSection = requestedSection;

  const sortToggle = (
    <div className="inline-flex gap-0.5 rounded-lg border border-border bg-surface p-0.5">
      {(
        [
          ["progress", "Most progress"],
          ["roster", "Roster order"],
        ] as const
      ).map(([key, label]) => (
        <Link
          key={key}
          href={dashboardHref({
            sort: key,
            char: selected?.id,
            section: selected ? section : null,
            domain: requestedDomain,
          })}
          className={`rounded-md px-2.5 py-1.5 text-xs ${
            sort === key ? "bg-accent-soft font-medium text-accent" : "text-fg-muted hover:text-fg"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );

  const board = (
    <>
      {selected && selectedCard && (
        <DashboardDetail
          sort={sort}
          section={section}
          domain={requestedDomain}
          scanned={!!selected.lastSeen}
          summaries={sectionSummaries(selected, selectedCard, data.scripts.length)}
          character={{
            id: selected.id,
            name: selected.name,
            className: selected.class,
            race: selected.race,
            alliance: selected.alliance,
            levelLabel: selectedCard.levelLabel,
            levelCaption: selectedCard.levelCaption,
            roles: selectedCard.roles,
            overall: selectedCard.overall,
          }}
        >
          {progressPanel(selected, section, requestedDomain, data)}
        </DashboardDetail>
      )}

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
          <DashboardCard
            key={char.id}
            char={char}
            sort={sort}
            selected={char.id === selected?.id}
            activeSection={selected ? section : null}
            activeDomain={requestedDomain}
          />
        ))}
      </div>
    </>
  );

  return (
    <LookSwitch
      classic={
        <div className="mx-auto w-full max-w-6xl">
          <PageHeader
            title="Dashboard"
            subtitle="Every character at a glance. Select a name or a bar to open that progress."
            action={sortToggle}
          />
          {board}
        </div>
      }
      atlas={
        <AtlasSection
          title="Dashboard"
          subtitle="Kept for bookmarks. Atlas puts the same progress meters on the Roster — open a character there for the workspace."
          action={sortToggle}
        >
          <Card className="mb-4 px-4 py-3 text-sm text-fg-muted">
            Prefer the regrouped view?{" "}
            <Link href="/characters" className="text-accent hover:underline">
              Open the Characters roster
            </Link>
            .
          </Card>
          {board}
        </AtlasSection>
      }
    />
  );
}

function sectionSummaries(
  character: Character,
  card: DashboardCardData,
  scriptTotal: number,
): Record<DashboardSection, string> {
  const lines = character.skillLines.length;
  const at50 = character.skillLines.filter((l) => l.rank >= 50).length;
  const skillRow = card.rows.find((row) => row.section === "skills");
  const research = presentResearch(character.research);
  const motifs = presentMotifs(character.motifs);
  const invested = character.champion.reduce((sum, d) => sum + d.stars.reduce((s, star) => s + star.points, 0), 0);
  const slotted = character.champion.flatMap((d) => d.stars.filter((s) => s.slotted)).length;
  const targets = card.overall;
  return {
    skills: skillRow?.detail ?? (lines ? `${at50} of ${lines} lines at 50` : "No lines yet"),
    crafting: research.total ? `${research.known}/${research.total} traits` : "No research yet",
    scribing: scriptTotal > 0 ? `${character.scribingScripts.length}/${scriptTotal} scripts` : "No catalog yet",
    knowledge: motifs.total ? `${motifs.known}/${motifs.total} chapters` : "No motifs yet",
    champion: character.champion.length ? `${invested.toLocaleString("en-US")} CP · ${slotted} slotted` : "No stars yet",
    targets: targets ? `${targets.done}/${targets.total} done` : "None yet",
  };
}

function skillLineHref(name: string, className?: string | null): string | null {
  try {
    const row = getSkillLineByName(name, className);
    return row ? `/encyclopedia/skills/${encodeURIComponent(row.entry.id)}` : null;
  } catch {
    return null;
  }
}

function lineOwningClass(lines: { name: string; className: string | null }[]) {
  const owners = new Map<string, Set<string>>();
  for (const line of lines) {
    if (!line.className) continue;
    const key = line.name.trim().toLowerCase();
    const set = owners.get(key) ?? new Set<string>();
    set.add(line.className);
    owners.set(key, set);
  }
  return (name: string) => {
    const set = owners.get(name.trim().toLowerCase());
    if (!set || set.size !== 1) return null;
    return [...set][0] ?? null;
  };
}

function progressPanel(
  character: Character,
  section: DashboardSection,
  domain: "skillline" | "ability" | "script" | null,
  data: NonNullable<ReturnType<typeof loadPlannerData>>,
): ReactNode {
  switch (section) {
    case "skills": {
      const names = character.skillLines.flatMap((line) =>
        line.abilities.flatMap((a) => [a.name, ...(a.morphs ?? []).map((m) => m.name)]),
      );
      const lore = safe(() => catalogAbilityLoreFor(names));
      return (
        <SkillBook
          categories={presentSkillBook(
            character.skillLines,
            lore ?? new Map(),
            (name) => skillLineHref(name, character.class),
            character.class,
            lineOwningClass(data.lines),
          )}
          lastSeen={character.lastSeen ?? null}
          characterClass={character.class}
        />
      );
    }
    case "crafting":
      return <CraftingPanel character={character} />;
    case "scribing": {
      const scripts: FocusScript[] = (safe(() => getScripts()) ?? []).map(({ entry }) => ({
        id: entry.id,
        name: entry.name,
        slot: entry.slot,
        effect: entry.effect,
        icon: entry.icon,
      }));
      return <ScribingPanel character={character} scripts={scripts} />;
    }
    case "knowledge":
      return <KnowledgePanel character={character} />;
    case "champion":
      return <ChampionPanel character={character} />;
    case "targets": {
      const goals = safe(() => listGoals()) ?? [];
      const lines = safe(() => skillLineChoices()) ?? [];
      const hrefForLine: Record<string, string> = {};
      for (const goal of goals) {
        if (goal.domain !== "skillline") continue;
        const key = goal.target.toLowerCase();
        if (hrefForLine[key]) continue;
        const dest = skillLineHref(goal.target, character.class);
        if (dest) hrefForLine[key] = dest;
      }
      const goalIndexes = safe(buildGoalIndexes) ?? { lineIndex: [], abilityIndex: [] };
      const roleIds = (safe(() => listAssignments()[character.id] ?? []) ?? []).filter(
        (id): id is string => typeof id === "string",
      );
      const rows = characterGoalRows(goals, toGoalSubject(character, roleIds, true), goalIndexes, (goal) =>
        goal.domain === "skillline" ? hrefForLine[goal.target.toLowerCase()] : undefined,
      ).filter((row) => !domain || row.goal.domain === domain);
      return (
        <CharacterGoals
          rows={rows}
          lines={lines}
          subjectId={character.id}
          subjectName={character.name}
          characterClass={character.class}
          catalog={{ lines: data.lines, abilities: data.abilities, scripts: data.scripts }}
        />
      );
    }
  }
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
