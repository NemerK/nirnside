import type {
  Character,
  CharacterResearch,
  MotifStyle,
  OutfitStyle,
  OutfitStyleCategory,
  RecipeList,
  ResearchCraft,
  ResearchLine,
} from "../snapshot/schema";

/** Strip lore-book prefixes so "Crafting Motif 15: Dwemer Style" matches "Dwemer". */
export function motifKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/^crafting motifs?\s+\d+\s*:\s*/i, "")
    .replace(/^craft motifs?\s+\d+\s*:\s*/i, "")
    .replace(/\s+style$/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

export function formatResearchRemaining(seconds: number): string {
  const n = Math.max(0, Math.floor(seconds));
  const d = Math.floor(n / 86400);
  const h = Math.floor((n % 86400) / 3600);
  const m = Math.floor((n % 3600) / 60);
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${n}s`;
}

export interface ResearchInProgress {
  craft: string;
  craftName: string;
  line: string;
  trait: string;
  remainingSeconds?: number;
}

export interface ResearchLineGroup {
  /** Shared trait-column names for this block (weapon vs armor vs jewelry). */
  traits: string[];
  lines: ResearchLine[];
}

export interface PresentedResearchCraft {
  craft: string;
  name: string;
  known: number;
  total: number;
  researching: number;
  maxSlots: number;
  groups: ResearchLineGroup[];
}

export interface PresentedResearch {
  crafts: PresentedResearchCraft[];
  known: number;
  total: number;
  inProgress: ResearchInProgress[];
}

function asResearch(value: unknown): CharacterResearch {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const crafts = (value as { crafts?: unknown }).crafts;
    if (Array.isArray(crafts)) return { crafts: crafts as ResearchCraft[] };
  }
  return { crafts: [] };
}

function lineTraitNames(line: ResearchLine): string[] {
  return line.traits.map((t) => t.name);
}

function groupLines(lines: ResearchLine[]): ResearchLineGroup[] {
  const groups: ResearchLineGroup[] = [];
  const index = new Map<string, ResearchLineGroup>();
  for (const line of lines) {
    const key = lineTraitNames(line).join("|");
    let group = index.get(key);
    if (!group) {
      group = { traits: lineTraitNames(line), lines: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.lines.push(line);
  }
  return groups;
}

export function presentResearch(research: CharacterResearch | unknown): PresentedResearch {
  const crafts: PresentedResearchCraft[] = [];
  const inProgress: ResearchInProgress[] = [];
  let known = 0;
  let total = 0;
  for (const craft of asResearch(research).crafts) {
    let craftKnown = 0;
    let craftTotal = 0;
    let researching = 0;
    for (const line of craft.lines) {
      for (const trait of line.traits) {
        craftTotal += 1;
        if (trait.known) craftKnown += 1;
        if (trait.researching) {
          researching += 1;
          inProgress.push({
            craft: craft.craft,
            craftName: craft.name || craft.craft,
            line: line.name,
            trait: trait.name,
            remainingSeconds: trait.remainingSeconds,
          });
        }
      }
    }
    known += craftKnown;
    total += craftTotal;
    crafts.push({
      craft: craft.craft,
      name: craft.name || craft.craft,
      known: craftKnown,
      total: craftTotal,
      researching,
      maxSlots: craft.maxSlots,
      groups: groupLines(craft.lines),
    });
  }
  return { crafts, known, total, inProgress };
}

export interface PresentedMotifs {
  styles: MotifStyle[];
  known: number;
  total: number;
}

export function presentMotifs(styles: MotifStyle[] | undefined): PresentedMotifs {
  let known = 0;
  let total = 0;
  const list = styles ?? [];
  for (const style of list) {
    known += style.known;
    total += style.total;
  }
  return { styles: list, known, total };
}

export interface PresentedRecipeLists {
  lists: RecipeList[];
  known: number;
  total: number;
}

export function presentRecipeLists(
  lists: RecipeList[] | undefined,
  kind: RecipeList["kind"],
): PresentedRecipeLists {
  const filtered = (lists ?? []).filter((l) => l.kind === kind);
  let known = 0;
  let total = 0;
  for (const list of filtered) {
    known += list.known;
    total += list.total;
  }
  return { lists: filtered, known, total };
}

export function characterHasKnowledgeScan(c: Character): boolean {
  if (asResearch(c.research).crafts.length > 0) return true;
  if ((c.motifs ?? []).length > 0) return true;
  if ((c.recipeLists ?? []).length > 0) return true;
  return false;
}

export function knowledgeHasAnyScan(characters: Character[]): boolean {
  return characters.some(characterHasKnowledgeScan);
}

export interface KnowledgeAccountSummary {
  researchKnown: number;
  researchTotal: number;
  motifKnown: number;
  motifTotal: number;
  recipeKnown: number;
  recipeTotal: number;
  planKnown: number;
  planTotal: number;
  scanned: number;
  total: number;
}

export function summarizeAccountKnowledge(characters: Character[]): KnowledgeAccountSummary {
  const summary: KnowledgeAccountSummary = {
    researchKnown: 0,
    researchTotal: 0,
    motifKnown: 0,
    motifTotal: 0,
    recipeKnown: 0,
    recipeTotal: 0,
    planKnown: 0,
    planTotal: 0,
    scanned: 0,
    total: characters.length,
  };
  for (const c of characters) {
    if (characterHasKnowledgeScan(c)) summary.scanned += 1;
    const research = presentResearch(c.research);
    summary.researchKnown += research.known;
    summary.researchTotal += research.total;
    const motifs = presentMotifs(c.motifs);
    summary.motifKnown += motifs.known;
    summary.motifTotal += motifs.total;
    const recipes = presentRecipeLists(c.recipeLists, "provisioning");
    summary.recipeKnown += recipes.known;
    summary.recipeTotal += recipes.total;
    const plans = presentRecipeLists(c.recipeLists, "furnishing");
    summary.planKnown += plans.known;
    summary.planTotal += plans.total;
  }
  return summary;
}

export interface PresentedOutfitStyle extends OutfitStyle {
  motifKey: string;
}

export interface PresentedOutfitGroup {
  name: string;
  motifKey: string;
  unlocked: number;
  total: number;
  styles: PresentedOutfitStyle[];
}

export interface PresentedOutfitCategory {
  name: string;
  unlocked: number;
  total: number;
  groups: PresentedOutfitGroup[];
}

export interface PresentedOutfitStyles {
  categories: PresentedOutfitCategory[];
  unlocked: number;
  total: number;
}

export function presentOutfitStyles(categories: OutfitStyleCategory[] | undefined): PresentedOutfitStyles {
  const out: PresentedOutfitCategory[] = [];
  let unlocked = 0;
  let total = 0;
  for (const category of categories ?? []) {
    const groups: PresentedOutfitGroup[] = [];
    let catUnlocked = 0;
    let catTotal = 0;
    for (const group of category.groups) {
      let groupUnlocked = 0;
      const styles: PresentedOutfitStyle[] = group.styles.map((style) => {
        if (style.unlocked) groupUnlocked += 1;
        return { ...style, motifKey: motifKey(group.name || style.name) };
      });
      catUnlocked += groupUnlocked;
      catTotal += styles.length;
      groups.push({
        name: group.name,
        motifKey: motifKey(group.name),
        unlocked: groupUnlocked,
        total: styles.length,
        styles,
      });
    }
    unlocked += catUnlocked;
    total += catTotal;
    out.push({ name: category.name, unlocked: catUnlocked, total: catTotal, groups });
  }
  return { categories: out, unlocked, total };
}

export function accountHasOutfitStylesScan(categories: OutfitStyleCategory[] | undefined): boolean {
  return (categories ?? []).some((c) => c.groups.some((g) => g.styles.length > 0));
}

/** Motif keys this character knows at least one chapter of — for style cross-links. */
export function knownMotifKeys(styles: MotifStyle[] | undefined): Set<string> {
  const keys = new Set<string>();
  for (const style of styles ?? []) {
    if (style.known > 0) keys.add(motifKey(style.name));
  }
  return keys;
}

export function recipeQualityClass(quality: number | undefined): string {
  switch (quality) {
    case 2:
      return "text-q-fine";
    case 3:
      return "text-q-superior";
    case 4:
      return "text-q-epic";
    case 5:
      return "text-q-legendary";
    default:
      return "text-fg";
  }
}
