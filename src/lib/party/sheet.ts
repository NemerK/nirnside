import { SKILL_CATEGORIES, skillCategory, type SkillCategory } from "../game/skills";
import { loadoutOf } from "../game/loadout";
import type { Character } from "../snapshot/schema";
import { presentMotifs, presentRecipeLists, presentResearch } from "../knowledge/present";
import { skillLineCap } from "../game/skill-caps";
import { isClassMasteryLineName } from "../game/class-mastery";

/**
 * The Party character sheet, as small module summaries. Each module carries
 * only what its card shows; the full boards live on the module's own page.
 */

export interface GearPiece {
  slot: string;
  name: string;
  setName: string | null;
  trait: string | null;
  enchant: string | null;
  quality: string | null;
}

export interface GearSummary {
  /** Armor and jewelry, worn whichever bar is out. */
  body: GearPiece[];
  front: GearPiece[];
  back: GearPiece[];
  /** Set pieces counted the way the game does with the front bar out. */
  frontSets: { name: string; count: number }[];
  /** Sets whose count changes when the back bar is out. */
  backSets: { name: string; count: number }[];
}

export interface LineSummary {
  name: string;
  category: string;
  rank: number;
  cap: number | null;
  subclassed: boolean;
}

export interface ChampionSummary {
  discipline: string;
  slotted: string[];
  spent: number;
}

export interface CraftSummary {
  craft: string;
  known: number;
  total: number;
  researching: number;
  slots: number;
}

export interface SheetSummary {
  gear: GearSummary;
  lines: LineSummary[];
  champion: ChampionSummary[];
  setups: { zone: string; page: string; setups: string[] }[];
  crafts: CraftSummary[];
  running: { craft: string; line: string; trait: string; remaining: number | null }[];
  motifs: { known: number; total: number };
  recipes: { known: number; total: number };
  plans: { known: number; total: number };
  scripts: number;
}

function piece(e: Character["equipped"][number]): GearPiece {
  return {
    slot: e.slot,
    name: e.name,
    setName: e.setName ?? null,
    trait: e.trait ?? null,
    enchant: e.enchant ?? null,
    quality: e.quality ?? null,
  };
}

/**
 * Body, front bar and back bar, and the sets each bar has active, by the
 * game model's rules (loadoutOf: body pieces count on both bars, a
 * two-hander counts twice, perfected and normal pieces are one set).
 */
export function presentGear(equipped: Character["equipped"]): GearSummary {
  const loadout = loadoutOf(equipped);
  const body: GearPiece[] = [];
  const front: GearPiece[] = [];
  const back: GearPiece[] = [];
  equipped.forEach((e, i) => {
    const bar = loadout.pieces[i].bar;
    (bar === "back" ? back : bar === "front" ? front : body).push(piece(e));
  });
  const named = loadout.sets.filter((s) => s.name);
  const frontSets = named
    .filter((s) => s.front > 0)
    .map((s) => ({ name: s.name, count: s.front }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const backSets = named
    .filter((s) => s.back !== s.front && s.back > 0)
    .map((s) => ({ name: s.name, count: s.back }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { body, front, back, frontSets, backSets };
}


export function presentLines(lines: Character["skillLines"]): LineSummary[] {
  return lines
    .filter((l) => !isClassMasteryLineName(l.name))
    .map((l) => ({
      name: l.name,
      category: l.category,
      rank: l.rank,
      // The line's own cap from the save (the game's), else the reference.
      cap: l.maxRank ?? skillLineCap(l.name),
      subclassed: l.subclassed,
    }))
    .sort((a, b) => {
      // The game's Skills window order (game/skills.ts).
      const ai = SKILL_CATEGORIES.indexOf(skillCategory(a.category) as SkillCategory);
      const bi = SKILL_CATEGORIES.indexOf(skillCategory(b.category) as SkillCategory);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || Number(a.subclassed) - Number(b.subclassed);
    });
}

export function presentSheet(c: Character, nowUnix: number): SheetSummary {
  const research = presentResearch(c.research);
  const elapsed = c.lastSeen != null ? Math.max(0, nowUnix - c.lastSeen) : 0;
  const zones = c.wardrobe?.zones ?? [];
  return {
    gear: presentGear(c.equipped),
    lines: presentLines(c.skillLines),
    champion: c.champion
      .map((d) => ({
        discipline: d.name,
        slotted: d.stars.filter((s) => s.slotted).map((s) => s.name),
        spent: d.stars.reduce((n, s) => n + (s.points ?? 0), 0),
      }))
      .filter((d) => d.slotted.length > 0 || d.spent > 0),
    setups: zones.flatMap((z) =>
      z.pages.map((p) => ({ zone: z.name, page: p.name, setups: p.setups.map((s) => s.name).filter(Boolean) })),
    ),
    crafts: research.crafts.map((cr) => ({
      craft: cr.name,
      known: cr.known,
      total: cr.total,
      researching: cr.researching,
      slots: cr.maxSlots,
    })),
    running: research.inProgress
      .map((r) => ({
        craft: r.craftName,
        line: r.line,
        trait: r.trait,
        remaining: r.remainingSeconds == null ? null : Math.max(0, r.remainingSeconds - elapsed),
      }))
      .sort((a, b) => (a.remaining ?? Infinity) - (b.remaining ?? Infinity)),
    motifs: (({ known, total }) => ({ known, total }))(presentMotifs(c.motifs)),
    recipes: (({ known, total }) => ({ known, total }))(presentRecipeLists(c.recipeLists, "provisioning")),
    plans: (({ known, total }) => ({ known, total }))(presentRecipeLists(c.recipeLists, "furnishing")),
    scripts: c.scribingScripts.length,
  };
}
