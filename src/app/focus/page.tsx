import { Crosshair } from "lucide-react";
import { getCharacter, getCharacters } from "@/lib/db/queries";
import { catalogAbilityLoreFor, getScripts, getSkillLineByName } from "@/lib/db/catalog-queries";
import { listGoals } from "@/lib/db/goals";
import { buildGoalIndexes, characterGoalRows, skillLineChoices } from "@/lib/planner/data";
import { listAssignments } from "@/lib/db/roles";
import { toGoalSubject } from "@/lib/goals/progress";
import { FOCUS_AREAS, focusAreasFor, getFocusConfig } from "@/lib/focus/config";
import { presentSkillBook } from "@/lib/skills/present";
import { EmptyState, PageFrame, PageHeader } from "@/components/ui";
import { LoadDemoButton } from "@/components/demo-controls";
import { SkillBook } from "@/components/skill-book";
import { CharacterGoals } from "@/components/goals-board";
import {
  ChampionPanel,
  CraftingPanel,
  KnowledgePanel,
  ScribingPanel,
  type FocusScript,
} from "@/components/focus-panels";
import { FocusBoard } from "@/components/focus-board";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}

function skillLineHref(name: string, className?: string | null): string | null {
  try {
    const row = getSkillLineByName(name, className);
    return row ? `/encyclopedia/skills/${encodeURIComponent(row.entry.id)}` : null;
  } catch {
    return null;
  }
}

export default async function FocusPage({ searchParams }: PageProps<"/focus">) {
  const sp = await searchParams;
  const roster = (safe(() => getCharacters()) ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    lastSeen: c.lastSeen ?? null,
  }));

  if (roster.length === 0) {
    return (
      <PageFrame>
        <PageHeader
          title="Focus"
          subtitle="Pick a character and what you care about right now — skills, crafting, scribing, knowledge, goals."
        />
        <EmptyState title="No characters yet" icon={<Crosshair className="h-8 w-8" />}>
          <p className="mb-4">
            Focus works from your ESO snapshots. Import your account first — point Nirnside at your ESO folder and log
            out once in game.
          </p>
          <div className="flex flex-col items-center gap-2">
            <a
              href="/setup"
              className="inline-flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-accent-fg"
            >
              Open Setup
            </a>
            <LoadDemoButton />
          </div>
        </EmptyState>
      </PageFrame>
    );
  }

  const paramChar = typeof sp.char === "string" ? sp.char : null;
  const savedChar = safe(() => getFocusConfig().char) ?? null;
  const selectedId =
    (paramChar && roster.find((c) => c.id === paramChar)?.id) ||
    roster.find((c) => c.id === savedChar)?.id ||
    roster[0].id;
  const character = safe(() => getCharacter(selectedId));
  const areas = safe(() => focusAreasFor(selectedId)) ?? FOCUS_AREAS.map((a) => a.id);

  const panels: { id: string; node: ReactNode }[] = [];
  if (character) {
    for (const area of FOCUS_AREAS) {
      if (!areas.includes(area.id)) continue;
      switch (area.id) {
        case "skills": {
          const names = character.skillLines.flatMap((line) =>
            line.abilities.flatMap((a) => [a.name, ...(a.morphs ?? []).map((m) => m.name)]),
          );
          const lore = safe(() => catalogAbilityLoreFor(names));
          panels.push({
            id: "skills",
            node: (
              <div className="mb-6">
                <SkillBook
                  categories={presentSkillBook(
                    character.skillLines,
                    lore ?? new Map(),
                    (name) => skillLineHref(name, character.class),
                    character.class,
                  )}
                  lastSeen={character.lastSeen ?? null}
                />
              </div>
            ),
          });
          break;
        }
        case "crafting":
          panels.push({ id: "crafting", node: <CraftingPanel character={character} /> });
          break;
        case "scribing": {
          const scripts: FocusScript[] = (safe(() => getScripts()) ?? []).map(({ entry }) => ({
            id: entry.id,
            name: entry.name,
            slot: entry.slot,
            effect: entry.effect,
          }));
          panels.push({ id: "scribing", node: <ScribingPanel character={character} scripts={scripts} /> });
          break;
        }
        case "knowledge":
          panels.push({ id: "knowledge", node: <KnowledgePanel character={character} /> });
          break;
        case "champion":
          panels.push({ id: "champion", node: <ChampionPanel character={character} /> });
          break;
        case "goals": {
          const goals = safe(() => listGoals()) ?? [];
          const lines = safe(() => skillLineChoices()) ?? [];
          const hrefForLine: Record<string, string> = {};
          for (const g of goals) {
            if (g.domain !== "skillline") continue;
            const key = g.target.toLowerCase();
            if (hrefForLine[key]) continue;
            const dest = skillLineHref(g.target, character.class);
            if (dest) hrefForLine[key] = dest;
          }
          const goalIndexes = safe(buildGoalIndexes) ?? { lineIndex: [], abilityIndex: [] };
          const roleIds = (safe(() => (listAssignments()[character.id] ?? [])) ?? []).filter(
            (id): id is string => typeof id === "string",
          );
          const goalRows = characterGoalRows(
            goals,
            toGoalSubject(character, roleIds, true),
            goalIndexes,
            (g) => (g.domain === "skillline" ? hrefForLine[g.target.toLowerCase()] : undefined),
          );
          panels.push({
            id: "goals",
            node: (
              <CharacterGoals rows={goalRows} lines={lines} subjectId={character.id} subjectName={character.name} />
            ),
          });
          break;
        }
      }
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Focus"
        subtitle="Pick a character and what you care about right now. Everything below is read from your last snapshot — nothing is guessed."
      />
      <FocusBoard
        characters={roster}
        selectedId={selectedId}
        scanned={!!character?.lastSeen}
        areas={areas}
        areaOptions={FOCUS_AREAS}
        panels={panels}
      />
    </div>
  );
}
