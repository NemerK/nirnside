import type { Character } from "../snapshot/schema";
import type { Goal, GoalIndexes, GoalSubject } from "../goals/types";
import { goalAppliesTo, goalProgress, toGoalSubject } from "../goals/progress";
import {
  presentMotifs,
  presentResearch,
  type PresentedMotifs,
  type PresentedResearch,
} from "../knowledge/present";

/**
 * Character workspace view model.
 *
 * Classic split "Dashboard" (progress rings) from "Characters" (roster + sheet).
 * Those are the same grain of data — one character blob. Atlas merges them:
 * the roster shows progress; opening a toon is the workspace.
 */

export type WorkspaceSection = "skills" | "crafting" | "scribing" | "knowledge" | "champion" | "targets";

export interface ProgressTally {
  done: number;
  total: number;
  pct: number;
}

export interface CharacterWorkspaceCard {
  id: string;
  name: string;
  className: string;
  race: string;
  alliance: Character["alliance"];
  level: number;
  championPoints: number;
  lastSeen: number | null;
  /** Never snapshotted with the addon — treat skills/dailies as unknown. */
  unknown: boolean;
  vampire: boolean;
  werewolf: boolean;
  classMastery: boolean;
  targets: ProgressTally;
  research: ProgressTally;
  motifs: ProgressTally;
  scribingKnown: number;
  skillLineCount: number;
}

function tally(done: number, total: number): ProgressTally {
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

function targetTally(goals: Goal[], subject: GoalSubject, indexes: GoalIndexes): ProgressTally {
  let done = 0;
  let total = 0;
  for (const goal of goals) {
    if (!goalAppliesTo(goal, subject)) continue;
    const progress = goalProgress(goal, subject, indexes);
    if (progress.state === "notapplicable") continue;
    total += 1;
    if (progress.state === "done") done += 1;
  }
  return tally(done, total);
}

function researchTally(research: PresentedResearch | null): ProgressTally {
  if (!research) return tally(0, 0);
  return tally(research.known, research.total);
}

function motifTally(motifs: PresentedMotifs | null): ProgressTally {
  if (!motifs) return tally(0, 0);
  return tally(motifs.known, motifs.total);
}

export function presentCharacterWorkspaceCard(
  character: Character,
  goals: Goal[],
  indexes: GoalIndexes,
): CharacterWorkspaceCard {
  const unknown = character.lastSeen == null;
  const subject = toGoalSubject(character);
  const research = unknown ? null : presentResearch(character.research);
  const motifs = unknown ? null : presentMotifs(character.motifs);

  return {
    id: character.id,
    name: character.name,
    className: character.class,
    race: character.race,
    alliance: character.alliance,
    level: character.level,
    championPoints: character.championPoints,
    lastSeen: character.lastSeen,
    unknown,
    vampire: character.vampire?.isVampire ?? false,
    werewolf: character.werewolf?.isWerewolf ?? false,
    classMastery: character.classMastery ?? false,
    targets: unknown ? tally(0, 0) : targetTally(goals, subject, indexes),
    research: researchTally(research),
    motifs: motifTally(motifs),
    scribingKnown: unknown ? 0 : character.scribingScripts?.length ?? 0,
    skillLineCount: unknown ? 0 : character.skillLines?.length ?? 0,
  };
}

export function presentCharacterWorkspaceCards(
  characters: Character[],
  goals: Goal[],
  indexes: GoalIndexes,
): CharacterWorkspaceCard[] {
  return characters.map((c) => presentCharacterWorkspaceCard(c, goals, indexes));
}

export function overallWorkspacePct(card: CharacterWorkspaceCard): number {
  if (card.unknown) return 0;
  const parts = [card.targets, card.research, card.motifs].filter((p) => p.total > 0);
  if (parts.length === 0) return 0;
  const done = parts.reduce((s, p) => s + p.done, 0);
  const total = parts.reduce((s, p) => s + p.total, 0);
  return total > 0 ? Math.round((done / total) * 100) : 0;
}
