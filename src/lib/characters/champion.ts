/** Four slottables per discipline, matching the champion bar. */
export const CHAMPION_SLOT_COUNT = 4;

export type ChampionKind = "slottable" | "passive" | "cluster";

export type ChampionStarView = {
  name: string;
  points: number;
  slotted: boolean;
  /** 1–4 on that discipline's bar, when the snapshot recorded the slot. */
  slot?: number;
  kind?: ChampionKind;
  icon?: string;
};

export type ChampionGroups = {
  /** Index 0 is the first circle. Empty circles are null. */
  equipped: (ChampionStarView | null)[];
  /** Slotted stars that did not fit in the four circles. */
  overflow: ChampionStarView[];
  /** Slottable stars with points that are not on the bar. */
  unlocked: ChampionStarView[];
  passives: ChampionStarView[];
  /**
   * Invested slottables are present, and none of them is marked on the bar.
   * Older snapshots stored every star as unslotted.
   */
  barUnknown: boolean;
};

/**
 * Split one discipline into the bar, the slottables waiting off it, and the
 * passives. `catalogKinds` covers snapshots that predate the kind field.
 */
export function groupChampionStars(
  stars: ChampionStarView[],
  catalogKinds: ReadonlyMap<string, ChampionKind> = new Map(),
): ChampionGroups {
  const equipped: (ChampionStarView | null)[] = Array.from({ length: CHAMPION_SLOT_COUNT }, () => null);
  const overflow: ChampionStarView[] = [];
  const unlocked: ChampionStarView[] = [];
  const passives: ChampionStarView[] = [];
  const waiting: ChampionStarView[] = [];
  let investedSlottables = 0;
  let slottedSlottables = 0;

  for (const star of stars) {
    const kind = resolveKind(star, catalogKinds);
    if (kind === "passive") {
      if (star.points > 0) passives.push(star);
      continue;
    }
    if (kind === "cluster") continue;
    if (star.points > 0 || star.slotted) investedSlottables += 1;
    if (star.slotted) {
      slottedSlottables += 1;
      waiting.push(star);
      continue;
    }
    if (star.points > 0) unlocked.push(star);
  }

  for (const star of waiting) {
    const index = star.slot == null ? -1 : star.slot - 1;
    if (index >= 0 && index < CHAMPION_SLOT_COUNT && equipped[index] == null) {
      equipped[index] = star;
    } else {
      overflow.push(star);
    }
  }
  for (const star of overflow) {
    const hole = equipped.findIndex((slot) => slot == null);
    if (hole < 0) break;
    equipped[hole] = star;
  }
  const placed = new Set(equipped.filter((star): star is ChampionStarView => star != null));
  const stillOut = overflow.filter((star) => !placed.has(star));

  return {
    equipped,
    overflow: stillOut,
    unlocked,
    passives,
    barUnknown: investedSlottables > 0 && slottedSlottables === 0,
  };
}

/**
 * Craft is the green tree and Warfare is the blue one. A snapshot that
 * asked for stars by discipline id instead of index files each of those
 * trees under the other name. When the catalog can see that, hand the
 * stars back. Fitness is the red tree and is left where it is.
 */
export function alignChampionDisciplines<T extends { name: string; stars: { name: string }[] }>(
  disciplines: T[],
  catalogCategory: ReadonlyMap<string, string>,
): T[] {
  const craft = disciplines.find((disc) => keyOf(disc.name) === "craft");
  const warfare = disciplines.find((disc) => keyOf(disc.name) === "warfare");
  if (!craft || !warfare) return disciplines;

  let agree = 0;
  let disagree = 0;
  for (const star of craft.stars) vote("craft", star.name);
  for (const star of warfare.stars) vote("warfare", star.name);
  if (disagree === 0 || disagree <= agree) return disciplines;

  return disciplines.map((disc) => {
    const key = keyOf(disc.name);
    if (key === "craft") return { ...disc, stars: warfare.stars };
    if (key === "warfare") return { ...disc, stars: craft.stars };
    return disc;
  });

  function vote(card: "craft" | "warfare", starName: string) {
    const category = catalogCategory.get(starName.trim().toLowerCase());
    if (category !== "craft" && category !== "warfare") return;
    if (category === card) agree += 1;
    else disagree += 1;
  }
}

function keyOf(name: string): string {
  return name.trim().toLowerCase();
}

function resolveKind(
  star: ChampionStarView,
  catalogKinds: ReadonlyMap<string, ChampionKind>,
): ChampionKind | null {
  if (star.kind) return star.kind;
  return catalogKinds.get(star.name.trim().toLowerCase()) ?? null;
}
