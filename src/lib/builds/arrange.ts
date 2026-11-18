import {
  isDivinesTrait,
  isTwoHandedWeapon,
  lineMatchesKind,
  locationLabel,
  reconstructionCost,
  setsShareKey,
  TRAIT_CHANGE_CRYSTALS,
  wantsDivines,
  weaponLabel,
  weaponResearchLine,
  type BarStyle,
  type FrontWeapon,
  type SlotKind,
} from "./slots";

export type GearRole = "body" | "monster" | "mythic" | "front" | "back";

export interface ArrangeSet {
  role: GearRole;
  name: string;
  setId: number | null;
  keys: string[];
  /** How many pieces this role should wear. */
  pieces: number;
  kinds: SlotKind[];
  /** Kinds with at least one collected stickerbook piece. */
  collectedKinds: SlotKind[];
  /** In-game icon path for a stickerbook piece of that slot, when the snapshot has one. */
  icons?: Partial<Record<SlotKind, string>>;
  /** Weapon types with a collected stickerbook piece. */
  collectedWeapons?: readonly FrontWeapon[];
  weaponIcons?: Partial<Record<FrontWeapon, string>>;
  collected: number;
  total: number;
  crafted: boolean;
  traitsNeeded: number | null;
}

export interface OwnedGear {
  keys: string[];
  setId: number | null;
  itemName: string;
  kind: SlotKind;
  trait: string | null;
  location: string;
  owner: string | null;
  /** In-game icon path from the bag item, when the snapshot recorded one. */
  icon?: string | null;
  /** Dagger, inferno staff, shield, and so on. Absent when the item name did not say. */
  weapon?: FrontWeapon | null;
}

export interface CrafterLine {
  name: string;
  known: number;
  divines: boolean;
}

export interface Crafter {
  name: string;
  lines: CrafterLine[];
}

export type PieceSource =
  | {
      kind: "owned";
      itemName: string;
      icon: string | null;
      trait: string | null;
      divines: boolean;
      location: string;
      owner: string | null;
      /** Set when the owned piece is not Divines and we change it at the station. */
      traitChangeCrystals: number | null;
    }
  | { kind: "craft"; trait: string; crafter: string }
  | { kind: "transmute"; crystals: number | null; trait: string | null; divines: boolean }
  | { kind: "farm" };

export interface PlacedPiece {
  slot: string;
  label: string;
  kind: SlotKind;
  pieces: number;
  role: GearRole;
  setName: string;
  /** Game icon for this piece: the owned item's, or the stickerbook piece's. */
  icon: string | null;
  source: PieceSource;
  /** True when the piece sits in the group the player asked for. */
  preferred: boolean;
  why: string | null;
  /** An owned piece we did not use because another route costs fewer crystals. */
  aside: string | null;
}

export interface ArrangeResult {
  placed: PlacedPiece[];
  short: { role: GearRole; setName: string; have: number; want: number }[];
  frontStyle: BarStyle;
  backStyle: BarStyle;
}

interface Unit {
  id: string;
  label: string;
  kind: SlotKind;
  pieces: number;
  preferred: "body" | "front" | "either";
  /** When set, only an item of this weapon counts as already made. */
  weapon?: FrontWeapon;
}

/** The weapons the player asked for on the front bar. A two-hander has no off hand. */
export interface FrontBarWeapons {
  main: FrontWeapon;
  off: FrontWeapon | null;
}

const SLOT_ORDER = [
  "head",
  "shoulders",
  "chest",
  "hands",
  "waist",
  "legs",
  "feet",
  "neck",
  "ring1",
  "ring2",
  "frontBar",
  "frontMain",
  "frontOff",
  "backBar",
  "backMain",
  "backOff",
];

const OWNED_DIVINES = 0;
const OWNED_AS_IS = 4;
const CRAFT = 8;
const FARM = 400;
/** One missing piece is worse than farming every other slot. */
const SHORT = 1_000_000;

function sameSet(set: ArrangeSet, item: OwnedGear): boolean {
  if (set.setId != null && set.setId > 0 && item.setId != null && item.setId > 0 && set.setId === item.setId) {
    return true;
  }
  return setsShareKey(set.keys, item.keys);
}

function canWear(set: ArrangeSet | undefined, kind: SlotKind): boolean {
  return !!set && set.kinds.includes(kind);
}

function lineFor(crafter: Crafter, kind: SlotKind, weapon?: FrontWeapon): CrafterLine | null {
  let best: CrafterLine | null = null;
  const wanted = weapon ? weaponResearchLine(weapon) : null;
  for (const line of crafter.lines) {
    const name = line.name.trim().toLowerCase();
    if (wanted ? name !== wanted : !lineMatchesKind(line.name, kind)) continue;
    if (!best || line.known > best.known) best = line;
  }
  return best;
}

function divineCrafter(set: ArrangeSet, kind: SlotKind, crafters: Crafter[], weapon?: FrontWeapon): Crafter | null {
  if (!set.crafted || set.traitsNeeded == null) return null;
  let best: { crafter: Crafter; known: number } | null = null;
  for (const crafter of crafters) {
    const line = lineFor(crafter, kind, weapon);
    if (!line || line.known < set.traitsNeeded) continue;
    if (wantsDivines(kind) && !line.divines) continue;
    if (!best || line.known > best.known) best = { crafter, known: line.known };
  }
  return best?.crafter ?? null;
}

function divinesKnown(kind: SlotKind, crafters: Crafter[]): boolean {
  if (!wantsDivines(kind)) return false;
  return crafters.some((crafter) => lineFor(crafter, kind)?.divines === true);
}

interface Choice {
  cost: number;
  source: PieceSource;
  /** Index into the set's owned list, when this choice consumes an item. */
  item: number | null;
}

function weaponCollected(set: ArrangeSet, kind: SlotKind, weapon?: FrontWeapon): boolean {
  if (!weapon) return set.collectedKinds.includes(kind);
  if (set.total > 0 && set.collected >= set.total) return true;
  if (set.collectedWeapons) return set.collectedWeapons.includes(weapon);
  return set.collectedKinds.includes(kind);
}

function fallbackChoice(set: ArrangeSet, kind: SlotKind, crafters: Crafter[], weapon?: FrontWeapon): Choice {
  const crafter = divineCrafter(set, kind, crafters, weapon);
  const collected = weaponCollected(set, kind, weapon);
  const crystals = collected ? reconstructionCost(set.collected, set.total) : null;
  const divine = wantsDivines(kind) && divinesKnown(kind, crafters);
  const options: Choice[] = [];
  if (crafter) {
    options.push({
      cost: CRAFT,
      item: null,
      source: { kind: "craft", trait: wantsDivines(kind) ? "Divines" : "a researched trait", crafter: crafter.name },
    });
  }
  if (collected) {
    // Unknown totals still mean "in the stickerbook". Rank them between a
    // known 25 and a farm, and do not print a made-up crystal count.
    const cost = crystals == null ? 60 : divine || !wantsDivines(kind) ? crystals : crystals + 20;
    options.push({
      cost,
      item: null,
      source: {
        kind: "transmute",
        crystals,
        trait: wantsDivines(kind) ? (divine ? "Divines" : null) : null,
        divines: divine || !wantsDivines(kind),
      },
    });
  }
  options.push({ cost: FARM, item: null, source: { kind: "farm" } });
  options.sort((a, b) => a.cost - b.cost);
  return options[0]!;
}

function ownedSource(
  item: OwnedGear,
  trait: { divines: boolean; traitChangeCrystals: number | null },
): Extract<PieceSource, { kind: "owned" }> {
  return {
    kind: "owned",
    itemName: item.itemName,
    icon: item.icon ?? null,
    trait: item.trait,
    divines: trait.divines,
    location: item.location,
    owner: item.owner,
    traitChangeCrystals: trait.traitChangeCrystals,
  };
}

function itemChoice(item: OwnedGear, index: number, kind: SlotKind, crafters: Crafter[]): Choice {
  const divine = isDivinesTrait(item.trait);
  if (!wantsDivines(kind) || divine) {
    return {
      cost: OWNED_DIVINES,
      item: index,
      source: ownedSource(item, { divines: divine || !wantsDivines(kind), traitChangeCrystals: null }),
    };
  }
  if (divinesKnown(kind, crafters)) {
    return {
      cost: TRAIT_CHANGE_CRYSTALS,
      item: index,
      source: ownedSource(item, { divines: true, traitChangeCrystals: TRAIT_CHANGE_CRYSTALS }),
    };
  }
  return {
    cost: OWNED_AS_IS,
    item: index,
    source: ownedSource(item, { divines: false, traitChangeCrystals: null }),
  };
}

/**
 * Give each slot the cheapest real source, and never use one physical item twice.
 * Owned pieces are taken only when they beat crafting, reconstructing, or farming.
 */
function allocate(
  set: ArrangeSet,
  units: Unit[],
  owned: OwnedGear[],
  crafters: Crafter[],
): { cost: number; sources: PieceSource[]; used: OwnedGear[] } {
  const mine = owned
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => sameSet(set, item));
  const fallbacks = units.map((unit) => fallbackChoice(set, unit.kind, crafters, unit.weapon));
  const used = new Set<number>();
  const chosen: (Choice | null)[] = units.map(() => null);

  const offers: { unit: number; choice: Choice; save: number }[] = [];
  units.forEach((unit, unitIndex) => {
    mine.forEach(({ item, index }) => {
      if (item.kind !== unit.kind) return;
      if (unit.weapon && item.weapon !== unit.weapon) return;
      const choice = itemChoice(item, index, unit.kind, crafters);
      const save = fallbacks[unitIndex]!.cost - choice.cost;
      if (save > 0) offers.push({ unit: unitIndex, choice, save });
    });
  });
  offers.sort((a, b) => b.save - a.save || a.choice.cost - b.choice.cost);
  for (const offer of offers) {
    if (chosen[offer.unit] || offer.choice.item == null || used.has(offer.choice.item)) continue;
    chosen[offer.unit] = offer.choice;
    used.add(offer.choice.item);
  }

  let cost = 0;
  const sources = units.map((_unit, index) => {
    const choice = chosen[index] ?? fallbacks[index]!;
    cost += choice.cost;
    return choice.source;
  });
  return {
    cost,
    sources,
    used: mine.filter(({ index }) => used.has(index)).map(({ item }) => item),
  };
}

function asideFor(
  set: ArrangeSet,
  unit: Unit,
  source: PieceSource,
  owned: OwnedGear[],
  used: readonly OwnedGear[],
  crafters: Crafter[],
): string | null {
  if (source.kind === "owned") return null;
  const leftover = owned.filter((item) => sameSet(set, item) && item.kind === unit.kind && !used.includes(item));
  if (leftover.length === 0) return null;
  const item = leftover
    .map((entry) => itemChoice(entry, 0, unit.kind, crafters))
    .sort((a, b) => a.cost - b.cost)[0];
  if (!item || item.source.kind !== "owned") return null;
  const where = placeWhere(item.source);
  if (item.source.traitChangeCrystals) {
    const crystals = source.kind === "transmute" ? source.crystals : null;
    const via = crystals == null ? "reconstructing it" : `reconstructing it (${crystals} crystals)`;
    return `${where} is ${item.source.trait ?? "another trait"}. Changing that trait is ${item.source.traitChangeCrystals} crystals, so ${via} is cheaper.`;
  }
  return null;
}

function placeWhere(source: Extract<PieceSource, { kind: "owned" }>): string {
  const who = source.owner ? `${source.owner} · ` : "";
  return `${who}${locationLabel(source.location)} · ${source.itemName}`;
}

export function sourceSummary(source: PieceSource): string {
  if (source.kind === "owned") {
    const who = source.location === "worn" && source.owner ? `${source.owner} · ` : "";
    const trait = source.trait ? ` · ${source.trait}` : "";
    return `${who}${locationLabel(source.location)}${trait}`;
  }
  if (source.kind === "craft") return `Craft · ${source.trait}`;
  if (source.kind === "transmute") return source.crystals == null ? "Stickerbook" : `${source.crystals} crystals`;
  return "Not obtained";
}

function unit(
  id: string,
  label: string,
  kind: SlotKind,
  preferred: Unit["preferred"],
  pieces = 1,
  weapon?: FrontWeapon,
): Unit {
  return { id, label, kind, pieces, preferred, weapon };
}

/** The player's front-bar weapons. A two-hander, staff, or bow is one item. */
export function frontWeaponUnits(choice: FrontBarWeapons): Unit[] {
  if (isTwoHandedWeapon(choice.main)) {
    return [unit("frontBar", weaponLabel(choice.main), "twoHand", "front", 2, choice.main)];
  }
  const off = choice.off && !isTwoHandedWeapon(choice.off) ? choice.off : choice.main;
  return [
    unit("frontMain", weaponLabel(choice.main), "oneHand", "front", 1, choice.main),
    unit("frontOff", weaponLabel(off), off === "shield" ? "shield" : "oneHand", "front", 1, off),
  ];
}

function frontWeaponStyle(choice: FrontBarWeapons): BarStyle {
  if (isTwoHandedWeapon(choice.main)) return "twohand";
  const off = choice.off && !isTwoHandedWeapon(choice.off) ? choice.off : choice.main;
  return off === "shield" ? "shield" : "dual";
}

function bodyUnits(): Unit[] {
  return [
    unit("head", "Head", "head", "either"),
    unit("shoulders", "Shoulders", "shoulders", "either"),
    unit("chest", "Chest", "chest", "body"),
    unit("hands", "Gloves", "hands", "body"),
    unit("waist", "Belt", "waist", "body"),
    unit("legs", "Legs", "legs", "body"),
    unit("feet", "Shoes", "feet", "body"),
    unit("neck", "Necklace", "neck", "front"),
    unit("ring1", "Ring", "ring", "front"),
    unit("ring2", "Ring", "ring", "front"),
  ];
}

function barUnits(bar: "front" | "back", style: BarStyle): Unit[] {
  const preferred: Unit["preferred"] = bar === "front" ? "front" : "either";
  const name = bar === "front" ? "Front" : "Back";
  if (style === "twohand") return [unit(`${bar}Bar`, `${name} bar`, "twoHand", preferred, 2)];
  if (style === "dual") {
    return [
      unit(`${bar}Main`, `${name} main hand`, "oneHand", preferred),
      unit(`${bar}Off`, `${name} off hand`, "oneHand", preferred),
    ];
  }
  return [
    unit(`${bar}Main`, `${name} main hand`, "oneHand", preferred),
    unit(`${bar}Off`, `${name} off hand`, "shield", preferred),
  ];
}

function styleFits(set: ArrangeSet | undefined, style: BarStyle): boolean {
  if (!set) return false;
  if (style === "twohand") return canWear(set, "twoHand");
  if (style === "dual") return canWear(set, "oneHand");
  return canWear(set, "oneHand") && canWear(set, "shield");
}

function take(units: Unit[], kind: SlotKind): Unit | null {
  const index = units.findIndex((entry) => entry.kind === kind);
  if (index < 0) return null;
  return units.splice(index, 1)[0] ?? null;
}

interface Fixed {
  unit: Unit;
  role: GearRole;
}

function lockFixed(
  sets: ArrangeSet[],
  frontStyle: BarStyle,
  backStyle: BarStyle,
  frontWeapons: FrontBarWeapons | null,
): { flex: Unit[]; fixed: Fixed[] } {
  const flex = bodyUnits();
  const fixed: Fixed[] = [];
  const mythic = sets.find((set) => set.role === "mythic");
  const monster = sets.find((set) => set.role === "monster");
  const back = sets.find((set) => set.role === "back");

  if (mythic) {
    const kind = mythic.kinds[0];
    const slot = kind ? take(flex, kind) : null;
    if (slot) fixed.push({ unit: slot, role: "mythic" });
  }
  if (monster) {
    let left = monster.pieces;
    for (const kind of ["head", "shoulders"] as const) {
      if (left <= 0) break;
      if (!canWear(monster, kind)) continue;
      const slot = take(flex, kind);
      if (!slot) continue;
      fixed.push({ unit: slot, role: "monster" });
      left -= 1;
    }
  }
  if (back && styleFits(back, backStyle)) {
    for (const slot of barUnits("back", backStyle)) fixed.push({ unit: slot, role: "back" });
  }
  const front = sets.find((set) => set.role === "front");
  if (front && frontWeapons) {
    for (const slot of frontWeaponUnits(frontWeapons)) fixed.push({ unit: slot, role: "front" });
  } else if (front && styleFits(front, frontStyle)) {
    flex.push(...barUnits("front", frontStyle));
  }
  return { flex, fixed };
}

/** Same set chosen for two roles shares one pile of owned items. */
function setIdentity(set: ArrangeSet): string {
  if (set.setId != null && set.setId > 0) return `id:${set.setId}`;
  return `k:${[...set.keys].sort().join("|")}`;
}

const KIND_LIST: SlotKind[] = [
  "head",
  "shoulders",
  "chest",
  "hands",
  "waist",
  "legs",
  "feet",
  "neck",
  "ring",
  "oneHand",
  "twoHand",
  "shield",
];

function costOfCounts(book: Map<SlotKind, KindPrice> | undefined, counts: Int16Array): number {
  let cost = 0;
  for (let index = 0; index < KIND_LIST.length; index += 1) {
    const count = counts[index] ?? 0;
    if (count === 0) continue;
    const priced = book?.get(KIND_LIST[index]!);
    const fallback = priced?.fallback ?? FARM;
    const items = priced?.items ?? [];
    const take = Math.min(count, items.length);
    for (let i = 0; i < take; i += 1) cost += items[i]!;
    cost += (count - take) * fallback;
  }
  return cost;
}

/** A two-hander wins a pure tie. A real cost difference (owned, craft, crystals) still beats it. */
function stylePenalty(style: BarStyle): number {
  return style === "twohand" ? 0 : 50;
}

interface KindPrice {
  fallback: number;
  /** Item costs that beat the fallback, cheapest first. One physical item each. */
  items: number[];
}

function priceBook(set: ArrangeSet, owned: OwnedGear[], crafters: Crafter[]): Map<SlotKind, KindPrice> {
  const book = new Map<SlotKind, KindPrice>();
  const kinds = new Set<SlotKind>(set.kinds);
  for (const item of owned) {
    if (sameSet(set, item)) kinds.add(item.kind);
  }
  for (const kind of kinds) {
    const fallback = fallbackChoice(set, kind, crafters).cost;
    const items = owned
      .filter((item) => sameSet(set, item) && item.kind === kind)
      .map((item, index) => itemChoice(item, index, kind, crafters).cost)
      .filter((cost) => cost < fallback)
      .sort((a, b) => a - b);
    book.set(kind, { fallback, items });
  }
  return book;
}

function bookCost(book: Map<SlotKind, KindPrice>, units: Unit[]): number {
  const counts = new Int16Array(KIND_LIST.length);
  for (const unit of units) {
    const index = KIND_LIST.indexOf(unit.kind);
    if (index >= 0) counts[index] = (counts[index] ?? 0) + 1;
  }
  return costOfCounts(book, counts);
}

/**
 * Place the chosen sets onto a paper doll.
 *
 * Mythic goes on its real slot first and takes only one ring when it is a ring.
 * Monster takes head, then shoulders. The back bar is the back-bar weapon.
 * Body and front then try every legal mix of the slots that are left. The mix
 * that uses owned Divines, then crafting, then the cheaper stickerbook
 * reconstruction, wins. A tie stays on the default: body on the five body
 * slots, weapons and jewelry on the front bar.
 */
export function arrange(
  sets: ArrangeSet[],
  owned: OwnedGear[],
  crafters: Crafter[],
  frontWeapons: FrontBarWeapons | null = null,
): ArrangeResult {
  const body = sets.find((set) => set.role === "body");
  const front = sets.find((set) => set.role === "front");
  const back = sets.find((set) => set.role === "back");
  const chosenWeapons = front && frontWeapons ? frontWeapons : null;
  const fronts: BarStyle[] = chosenWeapons
    ? [frontWeaponStyle(chosenWeapons)]
    : !front
      ? ["twohand"]
      : (["twohand", "dual", "shield"] as const).filter((style) => styleFits(front, style));
  const backs: BarStyle[] = !back
    ? ["twohand"]
    : (["twohand", "dual", "shield"] as const).filter((style) => styleFits(back, style));
  if (fronts.length === 0) fronts.push("twohand");
  if (backs.length === 0) backs.push("twohand");

  const books = new Map<string, Map<SlotKind, KindPrice>>();
  for (const set of sets) {
    const id = setIdentity(set);
    if (!books.has(id)) books.set(id, priceBook(set, owned, crafters));
  }

  const bodyId = body ? setIdentity(body) : "";
  const frontId = front ? setIdentity(front) : "";
  const samePool = bodyId !== "" && bodyId === frontId;

  let winner: { score: number; frontStyle: BarStyle; backStyle: BarStyle; flex: Unit[]; fixed: Fixed[]; assigned: number[] } | null =
    null;

  for (const frontStyle of fronts) {
    for (const backStyle of backs) {
      const { flex, fixed } = lockFixed(sets, frontStyle, backStyle, chosenWeapons);
      const kindOf = flex.map((slot) => KIND_LIST.indexOf(slot.kind));
      const prefOf = flex.map((slot) => (slot.preferred === "body" ? 0 : slot.preferred === "front" ? 1 : -1));
      const bodyBase = new Int16Array(KIND_LIST.length);
      const frontBase = new Int16Array(KIND_LIST.length);
      let fixedCost = 0;
      let fixedShort = 0;
      const fixedGroups = new Map<string, { set: ArrangeSet; units: Unit[] }>();
      for (const entry of fixed) {
        const set = sets.find((item) => item.role === entry.role);
        if (!set) continue;
        const id = setIdentity(set);
        const group = fixedGroups.get(id) ?? { set, units: [] };
        group.units.push(entry.unit);
        fixedGroups.set(id, group);
      }
      let fixedFrontPieces = 0;
      for (const [id, group] of fixedGroups) {
        const plain = group.units.filter((slot) => !slot.weapon);
        const specific = group.units.filter((slot) => slot.weapon);
        const have = group.units.reduce((sum, slot) => sum + slot.pieces, 0);
        if (group.set.role === "front") fixedFrontPieces += have;
        if (group.set.role !== "body" && group.set.role !== "front") {
          fixedShort += Math.max(0, group.set.pieces - have);
        }
        if (specific.length > 0) fixedCost += allocate(group.set, specific, owned, crafters).cost;
        const counts = id === bodyId || (samePool && id === bodyId) ? bodyBase : id === frontId ? frontBase : null;
        if (counts) {
          for (const slot of plain) {
            const index = KIND_LIST.indexOf(slot.kind);
            if (index >= 0) counts[index] = (counts[index] ?? 0) + 1;
          }
        } else if (plain.length > 0) {
          fixedCost += bookCost(books.get(id) ?? new Map(), plain);
        }
      }

      const assigned = flex.map(() => -1);
      let bestAssigned = assigned.slice();
      let bestScore = Number.POSITIVE_INFINITY;
      const bodyCounts = new Int16Array(KIND_LIST.length);
      const frontCounts = new Int16Array(KIND_LIST.length);
      const walk = (index: number, bodyPieces: number, frontPieces: number) => {
        if (index === flex.length) {
          bodyCounts.set(bodyBase);
          frontCounts.set(frontBase);
          let preferred = 0;
          let order = 0;
          for (let i = 0; i < flex.length; i += 1) {
            const who = assigned[i] ?? -1;
            if (who < 0) continue;
            order += i;
            const kind = kindOf[i] ?? -1;
            if (kind < 0) continue;
            if (who === 0) {
              bodyCounts[kind] = (bodyCounts[kind] ?? 0) + 1;
              if (prefOf[i] === 0) preferred += 1;
            } else if (samePool) {
              bodyCounts[kind] = (bodyCounts[kind] ?? 0) + 1;
              if (prefOf[i] === 1) preferred += 1;
            } else {
              frontCounts[kind] = (frontCounts[kind] ?? 0) + 1;
              if (prefOf[i] === 1) preferred += 1;
            }
          }
          const cost =
            fixedCost +
            (body ? costOfCounts(books.get(bodyId), bodyCounts) : 0) +
            (!samePool && front ? costOfCounts(books.get(frontId), frontCounts) : 0);
          const short =
            fixedShort +
            (body ? Math.max(0, body.pieces - bodyPieces) : 0) +
            (front ? Math.max(0, front.pieces - frontPieces) : 0);
          const score =
            short * SHORT + cost * 100 - preferred + stylePenalty(frontStyle) + stylePenalty(backStyle) + order / 1000;
          if (score < bestScore) {
            bestScore = score;
            bestAssigned = assigned.slice();
          }
          return;
        }
        const slot = flex[index]!;
        walk(index + 1, bodyPieces, frontPieces);
        if (body && bodyPieces + slot.pieces <= body.pieces && canWear(body, slot.kind)) {
          assigned[index] = 0;
          walk(index + 1, bodyPieces + slot.pieces, frontPieces);
          assigned[index] = -1;
        }
        if (front && frontPieces + slot.pieces <= front.pieces && canWear(front, slot.kind)) {
          assigned[index] = 1;
          walk(index + 1, bodyPieces, frontPieces + slot.pieces);
          assigned[index] = -1;
        }
      };
      walk(0, 0, fixedFrontPieces);
      if (!winner || bestScore < winner.score) {
        winner = { score: bestScore, frontStyle, backStyle, flex, fixed, assigned: bestAssigned };
      }
    }
  }

  const chosen = winner!;
  const placed: PlacedPiece[] = [];
  const slots: { set: ArrangeSet; unit: Unit; preferred: boolean }[] = [];
  const push = (set: ArrangeSet | undefined, slot: Unit, preferred: boolean) => {
    if (!set) return;
    slots.push({ set, unit: slot, preferred });
  };
  chosen.flex.forEach((slot, index) => {
    const owner = chosen.assigned[index];
    if (owner === 0) push(body, slot, slot.preferred === "body");
    else if (owner === 1) push(front, slot, slot.preferred === "front");
  });
  for (const entry of chosen.fixed) {
    const set = sets.find((item) => item.role === entry.role);
    push(set, entry.unit, true);
  }

  const bySet = new Map<string, { set: ArrangeSet; slots: typeof slots }>();
  for (const slot of slots) {
    const id = setIdentity(slot.set);
    const group = bySet.get(id) ?? { set: slot.set, slots: [] };
    group.slots.push(slot);
    bySet.set(id, group);
  }
  for (const group of bySet.values()) {
    const priced = allocate(
      group.set,
      group.slots.map((slot) => slot.unit),
      owned,
      crafters,
    );
    group.slots.forEach((slot, index) => {
      const source = priced.sources[index]!;
      const ownedIcon = source.kind === "owned" ? source.icon : null;
      placed.push({
        slot: slot.unit.id,
        label: slot.unit.label,
        kind: slot.unit.kind,
        pieces: slot.unit.pieces,
        role: slot.set.role,
        setName: slot.set.name,
        icon: ownedIcon || (slot.unit.weapon ? slot.set.weaponIcons?.[slot.unit.weapon] : null) || slot.set.icons?.[slot.unit.kind] || null,
        source,
        preferred: slot.preferred,
        why: slot.preferred ? null : whyOff(slot.set, source),
        aside: asideFor(slot.set, slot.unit, source, owned, priced.used, crafters),
      });
    });
  }

  placed.sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));

  const short: ArrangeResult["short"] = [];
  for (const set of sets) {
    const have = placed.filter((piece) => piece.role === set.role).reduce((sum, piece) => sum + piece.pieces, 0);
    if (have < set.pieces) short.push({ role: set.role, setName: set.name, have, want: set.pieces });
  }

  return { placed, short, frontStyle: chosen.frontStyle, backStyle: chosen.backStyle };
}

function whyOff(set: ArrangeSet, source: PieceSource): string {
  if (source.kind === "owned") return `${set.name} is already made for this slot, so it wears here.`;
  if (source.kind === "craft") return `${set.name} can be crafted for this slot.`;
  if (source.kind === "transmute") return `${set.name} is in the stickerbook, so this slot is reconstructed.`;
  return `${set.name} takes this slot so the pieces you already have stay equipped.`;
}
