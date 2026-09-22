import type { CatalogSource } from "../catalog/schema";
import type { MorphSlot, SkillLine, SkillMorph } from "../snapshot/schema";
import {
  abilityIsKnown,
  displayAbility,
  morphSlotPurchased,
  romanRank,
  slotLabel,
  xpProgress,
} from "./ability";

export type LoreHit = {
  icon: string | null;
  description: string;
  source: CatalogSource;
};

export type LoreIndex = Map<string, LoreHit>;

export type AbilitySlotView = {
  slot: number;
  label: string;
  name: string;
  purchased: boolean;
  rank: number | null;
  rankLabel: string;
  current: boolean;
  icon: string | null;
  description: string;
  xp: { value: number; max: number } | null;
};

export type AbilityView = {
  name: string;
  purchased: boolean;
  passive: boolean;
  showingMorph: boolean;
  skillStyle: string | null;
  rank: number;
  maxRank: number | null;
  icon: string | null;
  description: string;
  descriptionSource: CatalogSource | "unknown";
  morphs: AbilitySlotView[];
};

export type SkillLineView = {
  name: string;
  category: string;
  rank: number;
  subclassed: boolean;
  href: string | null;
  abilities: AbilityView[];
};

export type SkillCategoryView = {
  name: string;
  lines: SkillLineView[];
};

/** In-game skills window order. Unknown categories follow at the end. */
export const SKILL_CATEGORY_ORDER = [
  "Class",
  "Weapon",
  "Armor",
  "World",
  "Guild",
  "Alliance War",
  "Racial",
  "Craft",
];

export function loreKey(name: string): string {
  return name.trim().toLowerCase();
}

export function firstIcon(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    if (c && c.trim()) return c;
  }
  return null;
}

/**
 * Snapshot (in-game) wins over catalog. Empty snapshot fields fall through to
 * the catalog hit. Never invent a description — unknown stays empty.
 */
export function mergeLore(
  snapshot: { icon?: string | null; description?: string | null },
  hit: LoreHit | undefined,
): { icon: string | null; description: string; source: CatalogSource | "unknown" } {
  const icon = firstIcon(snapshot.icon, hit?.icon);
  const description = (snapshot.description && snapshot.description.trim()) || hit?.description || "";
  let source: CatalogSource | "unknown" = "unknown";
  if (snapshot.description && snapshot.description.trim()) source = "ingame";
  else if (hit?.description) source = hit.source;
  return { icon, description, source };
}

export function presentAbility(ability: SkillMorph, lore: LoreIndex): AbilityView {
  const known = abilityIsKnown(ability);
  const face = displayAbility(ability);
  const faceHit = lore.get(loreKey(face.name));
  const slots = ability.morphs ?? [];
  const currentSlot = slots.find((s) => s.slot === face.morphSlot);
  const anySlotIcon = slots.find((s) => s.icon && s.icon.trim())?.icon;
  const merged = mergeLore(
    {
      icon: currentSlot?.icon ?? ability.icon ?? anySlotIcon,
      description: currentSlot?.description ?? ability.description,
    },
    faceHit,
  );

  const morphs: AbilitySlotView[] = (ability.morphs ?? []).map((slot) => presentSlot(slot, face.morphSlot, known, lore));

  return {
    name: face.name,
    purchased: known,
    passive: ability.passive === true,
    showingMorph: face.showingMorph,
    skillStyle: ability.skillStyle,
    rank: ability.rank,
    maxRank: ability.maxRank ?? null,
    icon: merged.icon,
    description: merged.description,
    descriptionSource: merged.source,
    morphs,
  };
}

function presentSlot(slot: MorphSlot, currentSlot: number | null, abilityKnown: boolean, lore: LoreIndex): AbilitySlotView {
  const hit = lore.get(loreKey(slot.name));
  const merged = mergeLore({ icon: slot.icon, description: slot.description }, hit);
  return {
    slot: slot.slot,
    label: slotLabel(slot.slot),
    name: slot.name,
    purchased: morphSlotPurchased(slot),
    rank: morphSlotPurchased(slot) ? (slot.rank ?? null) : null,
    rankLabel: romanRank(morphSlotPurchased(slot) ? slot.rank : null),
    current: abilityKnown && currentSlot === slot.slot,
    icon: merged.icon,
    description: merged.description,
    xp: morphSlotPurchased(slot) ? xpProgress(slot) : null,
  };
}

export function presentSkillBook(
  lines: SkillLine[],
  lore: LoreIndex,
  hrefFor: (lineName: string) => string | null,
): SkillCategoryView[] {
  const byCat = new Map<string, SkillLineView[]>();
  for (const line of lines) {
    const cat = line.category || "Skill";
    const list = byCat.get(cat) ?? [];
    list.push({
      name: line.name,
      category: cat,
      rank: line.rank,
      subclassed: line.subclassed,
      href: hrefFor(line.name),
      abilities: line.abilities.map((a) => presentAbility(a, lore)),
    });
    byCat.set(cat, list);
  }

  const names = [...byCat.keys()].sort((a, b) => {
    const ia = SKILL_CATEGORY_ORDER.indexOf(a);
    const ib = SKILL_CATEGORY_ORDER.indexOf(b);
    const oa = ia === -1 ? SKILL_CATEGORY_ORDER.length : ia;
    const ob = ib === -1 ? SKILL_CATEGORY_ORDER.length : ib;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });

  return names.map((name) => ({ name, lines: byCat.get(name) ?? [] }));
}
