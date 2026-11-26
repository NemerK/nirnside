import type { Character } from "../snapshot/schema";
import { presentMotifs, presentRecipeLists, presentResearch } from "../knowledge/present";
import { skillLineCap } from "../skills/line-cap";
import { isClassMasteryLineName } from "../skills/class-mastery";

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
  companions: { name: string; level: number; rapport: string | null }[];
  scripts: number;
}

const WEAPON_SLOTS = /main hand|off hand|weapon|backup/i;

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

function countSets(pieces: GearPiece[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of pieces) {
    if (!p.setName) continue;
    out.set(p.setName, (out.get(p.setName) ?? 0) + 1);
  }
  return out;
}

export function presentGear(equipped: Character["equipped"]): GearSummary {
  const body: GearPiece[] = [];
  const front: GearPiece[] = [];
  const back: GearPiece[] = [];
  for (const e of equipped) {
    if (e.bar === "back") back.push(piece(e));
    else if (e.bar === "front" || WEAPON_SLOTS.test(e.slot)) front.push(piece(e));
    else body.push(piece(e));
  }
  const withFront = countSets([...body, ...front]);
  const withBack = countSets([...body, ...back]);
  const frontSets = [...withFront.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const backSets = [...withBack.entries()]
    .filter(([name, count]) => withFront.get(name) !== count)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { body, front, back, frontSets, backSets };
}

const CATEGORY_ORDER = ["class", "weapon", "armor", "world", "guild", "alliance war", "racial", "craft"];

export function presentLines(lines: Character["skillLines"]): LineSummary[] {
  return lines
    .filter((l) => !isClassMasteryLineName(l.name))
    .map((l) => ({
      name: l.name,
      category: l.category,
      rank: l.rank,
      cap: skillLineCap(l.name),
      subclassed: l.subclassed,
    }))
    .sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a.category.toLowerCase());
      const bi = CATEGORY_ORDER.indexOf(b.category.toLowerCase());
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
    companions: c.companions.map((x) => ({ name: x.name, level: x.level, rapport: x.rapport })),
    scripts: c.scribingScripts.length,
  };
}
