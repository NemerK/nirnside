import type { CharacterResearch } from "../snapshot/schema";
import { craftOf, pieceForResearchLine, pieceKey, type Craft, type PieceKind } from "./equipment";
import { canonicalTrait, traitsFor } from "./traits";

/**
 * A character's trait research, read as the game defines it: each research
 * line is one piece kind (robes and jerkins share a line), and a trait known
 * on a line lets the character craft that piece with that trait. Crafting a
 * set piece takes as many known traits on the line as the set requires
 * (the catalog's traitsNeeded), and the chosen trait must be one of them.
 *
 * The scan is the source: line and trait names come from
 * GetSmithingResearchLineInfo / GetSmithingResearchLineTraitInfo.
 */
export interface PieceResearch {
  piece: PieceKind;
  craft: Craft;
  /** The game's line name, as scanned. */
  line: string;
  known: Set<string>;
  researching: Map<string, number | null>;
  /** How many traits the line has (nine for every line today). */
  total: number;
}

/** Research per piece kind (pieceKey), for one character. Lines the model can't place are skipped. */
export function researchByPiece(research: CharacterResearch | null | undefined): Map<string, PieceResearch> {
  const out = new Map<string, PieceResearch>();
  for (const craft of research?.crafts ?? []) {
    for (const line of craft.lines) {
      const piece = pieceForResearchLine(line.name);
      if (!piece) continue;
      const known = new Set<string>();
      const researching = new Map<string, number | null>();
      for (const t of line.traits) {
        const name = canonicalTrait(t.name) ?? t.name;
        if (t.known) known.add(name);
        else if (t.researching) researching.set(name, t.remainingSeconds ?? null);
      }
      out.set(pieceKey(piece), {
        piece,
        craft: craftOf(piece),
        line: line.name,
        known,
        researching,
        total: line.traits.length || traitsFor(piece).length,
      });
    }
  }
  return out;
}

export interface CraftCheck {
  ok: boolean;
  known: number;
  /** Whether the chosen trait is researched; null when no trait was asked for. */
  hasTrait: boolean | null;
  /** Traits still to research before it can be made (the chosen trait included). */
  missing: number;
}

/** Can a character with this research make the piece for a set needing `traitsNeeded`, in `trait`? */
export function canCraft(
  byPiece: Map<string, PieceResearch>,
  piece: PieceKind,
  traitsNeeded: number,
  trait?: string | null,
): CraftCheck {
  const r = byPiece.get(pieceKey(piece));
  const known = r?.known.size ?? 0;
  const wanted = trait ? (canonicalTrait(trait) ?? trait) : null;
  const hasTrait = wanted ? !!r?.known.has(wanted) : null;
  const ok = !!r && known >= traitsNeeded && hasTrait !== false;
  return { ok, known, hasTrait, missing: ok ? 0 : Math.max(0, traitsNeeded - known) + (hasTrait === false ? 1 : 0) };
}

/**
 * Idle research slots for one craft: slots the character has, minus those
 * running. A craft with every trait known has nothing left to research, so
 * none of its slots count as idle.
 */
export function idleSlots(craft: { maxSlots: number; researching: number; known?: number; total?: number }): number {
  if (craft.total != null && craft.total > 0 && craft.known != null && craft.known >= craft.total) return 0;
  return Math.max(0, craft.maxSlots - craft.researching);
}

/** Idle slots per craft, from a raw scan. */
export function idleResearchSlots(research: CharacterResearch | null | undefined): Partial<Record<string, number>> {
  const out: Partial<Record<string, number>> = {};
  for (const craft of research?.crafts ?? []) {
    const traits = craft.lines.flatMap((l) => l.traits);
    out[craft.craft] = idleSlots({
      maxSlots: craft.maxSlots,
      researching: traits.filter((t) => t.researching).length,
      known: traits.filter((t) => t.known).length,
      total: traits.length,
    });
  }
  return out;
}
