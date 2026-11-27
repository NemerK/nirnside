import type { MotifStyle } from "../snapshot/schema";
import { ARMOR_SLOTS, WEIGHTS, type PieceKind, type Weapon } from "./equipment";

/**
 * Crafting motifs and styles. Sources: UESP Online:Crafting_Motifs and the
 * per-style collection pages.
 *
 * - A motif is a book that lets a character craft items in a style at
 *   Blacksmithing, Clothing and Woodworking. Jewelry has no style.
 * - Motif knowledge is per character; every character starts knowing its
 *   own race's motif.
 * - A motif is either one complete book or fourteen chapters: Axes, Belts,
 *   Boots, Bows, Chests, Daggers, Gloves, Helmets, Legs, Maces, Shields,
 *   Shoulders, Staves, Swords. A chapter covers its piece in every weight
 *   (Helmets: hat, helmet and helm) or its weapon in one and two hands
 *   (Axes: axe and battle axe).
 * - Reading a motif also unlocks the matching style in the outfit system,
 *   account-wide.
 */

export const MOTIF_CHAPTERS = [
  "Axes",
  "Belts",
  "Boots",
  "Bows",
  "Chests",
  "Daggers",
  "Gloves",
  "Helmets",
  "Legs",
  "Maces",
  "Shields",
  "Shoulders",
  "Staves",
  "Swords",
] as const;
export type MotifChapter = (typeof MOTIF_CHAPTERS)[number];

const armorChapter = (slot: (typeof ARMOR_SLOTS)[number]): PieceKind[] =>
  WEIGHTS.map((weight) => ({ kind: "armor", weight, slot }));
const weapons = (...w: Weapon[]): PieceKind[] => w.map((weapon) => ({ kind: "weapon", weapon }));

/** The pieces each chapter lets a character craft in that style. */
export const CHAPTER_PIECES: Record<MotifChapter, PieceKind[]> = {
  Helmets: armorChapter("head"),
  Shoulders: armorChapter("shoulders"),
  Chests: armorChapter("chest"),
  Gloves: armorChapter("hands"),
  Belts: armorChapter("waist"),
  Legs: armorChapter("legs"),
  Boots: armorChapter("feet"),
  Axes: weapons("axe", "battleaxe"),
  Maces: weapons("mace", "maul"),
  Swords: weapons("sword", "greatsword"),
  Daggers: weapons("dagger"),
  Bows: weapons("bow"),
  Staves: weapons("inferno", "ice", "lightning", "restoration"),
  Shields: weapons("shield"),
};

/** The chapter that covers a piece; null for jewelry (no style). */
export function chapterFor(piece: PieceKind): MotifChapter | null {
  if (piece.kind === "jewelry") return null;
  for (const ch of MOTIF_CHAPTERS) {
    if (CHAPTER_PIECES[ch].some((p) => JSON.stringify(p) === JSON.stringify(piece))) return ch;
  }
  return null;
}

/** "Crafting Motif 27: Ebonheart Pact Axes" or "Axes" → "Axes". */
export function chapterOfName(name: string): MotifChapter | null {
  const n = name.trim().toLowerCase();
  return MOTIF_CHAPTERS.find((ch) => n === ch.toLowerCase() || n.endsWith(` ${ch.toLowerCase()}`)) ?? null;
}

/**
 * The style a motif or outfit group names, as a key both sides share:
 * "Crafting Motif 14: Dwemer Style", "Dwemer", "Dwemer Axes" → "dwemer".
 */
export function styleKey(name: string): string {
  let n = name.trim().toLowerCase().replace(/[’']/g, "'");
  n = n.replace(/^craft(ing)? motifs?\s+\d+\s*:\s*/, "").replace(/\s+style$/, "");
  const chapter = MOTIF_CHAPTERS.find((ch) => n.endsWith(` ${ch.toLowerCase()}`));
  if (chapter) n = n.slice(0, -(chapter.length + 1));
  return n.trim();
}

export interface StyleKnowledge {
  style: string;
  /** Every chapter known (or the complete book). */
  complete: boolean;
  chapters: Set<MotifChapter>;
}

/**
 * What a character knows of one motif. A motif scanned as a single book
 * (no chapters) counts as complete when known.
 */
export function styleKnowledge(m: MotifStyle): StyleKnowledge {
  const chapters = new Set<MotifChapter>();
  for (const c of m.chapters) {
    if (!c.known) continue;
    const ch = chapterOfName(c.name);
    if (ch) chapters.add(ch);
  }
  const wholeBook = m.chapters.length <= 1 && m.total > 0 && m.known >= m.total;
  if (wholeBook) for (const ch of MOTIF_CHAPTERS) chapters.add(ch);
  return { style: styleKey(m.name), complete: wholeBook || chapters.size === MOTIF_CHAPTERS.length, chapters };
}

/** Can this character craft the piece in this style? */
export function canCraftInStyle(knowledge: StyleKnowledge, piece: PieceKind): boolean {
  const ch = chapterFor(piece);
  return ch != null && (knowledge.complete || knowledge.chapters.has(ch));
}
