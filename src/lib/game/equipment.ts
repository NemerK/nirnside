/**
 * Equipment as the game models it. One place for every piece kind, its
 * weight, slot, craft, research line and trait family.
 *
 * Sources:
 * - The addon reads ESO's own constants (EQUIP_TYPE_*, ARMORTYPE_*,
 *   WEAPONTYPE_*) and writes fixed labels for them ("Heavy Head", "Ring",
 *   "Greatsword"; see pieceTypeInfo in NirnsideSnapshot.lua). Those labels
 *   are the contract parsed here.
 * - Crafts, research and traits follow the game as documented on UESP
 *   (Online:Traits, Online:Crafting): Blacksmithing makes heavy armor and
 *   metal weapons; Clothing light and medium armor; Woodworking bows,
 *   staves and shields; Jewelry Crafting rings and necklaces. A trait is
 *   researched per item type (robes and jerkins share one line). Shields
 *   take armor traits.
 */

export const WEIGHTS = ["light", "medium", "heavy"] as const;
export type Weight = (typeof WEIGHTS)[number];

export const ARMOR_SLOTS = ["head", "shoulders", "chest", "hands", "waist", "legs", "feet"] as const;
export type ArmorSlot = (typeof ARMOR_SLOTS)[number];

export const JEWELRY = ["necklace", "ring"] as const;
export type Jewelry = (typeof JEWELRY)[number];

export const WEAPONS = [
  "axe",
  "mace",
  "sword",
  "dagger",
  "battleaxe",
  "maul",
  "greatsword",
  "bow",
  "inferno",
  "ice",
  "lightning",
  "restoration",
  "shield",
] as const;
export type Weapon = (typeof WEAPONS)[number];

export type Craft = "blacksmithing" | "clothing" | "woodworking" | "jewelry";
export type TraitFamily = "armor" | "weapon" | "jewelry";

/** Every craftable, collectible, wearable piece the game has, as one key. */
export type PieceKind =
  | { kind: "armor"; weight: Weight; slot: ArmorSlot }
  | { kind: "jewelry"; jewelry: Jewelry }
  | { kind: "weapon"; weapon: Weapon };

export const WEIGHT_LABEL: Record<Weight, string> = { light: "Light", medium: "Medium", heavy: "Heavy" };

export const SLOT_LABEL: Record<ArmorSlot, string> = {
  head: "Head",
  shoulders: "Shoulders",
  chest: "Chest",
  hands: "Hands",
  waist: "Waist",
  legs: "Legs",
  feet: "Feet",
};

export const JEWELRY_LABEL: Record<Jewelry, string> = { necklace: "Necklace", ring: "Ring" };

/** The addon's weapon labels, which are also the game's English names. */
export const WEAPON_LABEL: Record<Weapon, string> = {
  axe: "Axe",
  mace: "Mace",
  sword: "Sword",
  dagger: "Dagger",
  battleaxe: "Battle Axe",
  maul: "Maul",
  greatsword: "Greatsword",
  bow: "Bow",
  inferno: "Inferno Staff",
  ice: "Ice Staff",
  lightning: "Lightning Staff",
  restoration: "Restoration Staff",
  shield: "Shield",
};

/**
 * The game's English piece words by weight and slot. A motif or set piece is
 * named "<style or set> <word>", and research lines carry the same words.
 * Light chest has two (robe and jerkin) that share one research line.
 */
export const PIECE_WORDS: Record<Weight, Record<ArmorSlot, string[]>> = {
  light: {
    head: ["Hat"],
    shoulders: ["Epaulets"],
    chest: ["Robe", "Jerkin"],
    hands: ["Gloves"],
    waist: ["Sash"],
    legs: ["Breeches"],
    feet: ["Shoes"],
  },
  medium: {
    head: ["Helmet"],
    shoulders: ["Arm Cops"],
    chest: ["Jack"],
    hands: ["Bracers"],
    waist: ["Belt"],
    legs: ["Guards"],
    feet: ["Boots"],
  },
  heavy: {
    head: ["Helm"],
    shoulders: ["Pauldron", "Pauldrons"],
    chest: ["Cuirass"],
    hands: ["Gauntlets"],
    waist: ["Girdle"],
    legs: ["Greaves"],
    feet: ["Sabatons"],
  },
};

export const TWO_HANDED: ReadonlySet<Weapon> = new Set([
  "battleaxe",
  "maul",
  "greatsword",
  "bow",
  "inferno",
  "ice",
  "lightning",
  "restoration",
]);
export const STAVES: ReadonlySet<Weapon> = new Set(["inferno", "ice", "lightning", "restoration"]);

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ");

const SLOT_WORDS: Record<string, ArmorSlot> = {
  head: "head",
  shoulder: "shoulders",
  shoulders: "shoulders",
  chest: "chest",
  hand: "hands",
  hands: "hands",
  waist: "waist",
  leg: "legs",
  legs: "legs",
  foot: "feet",
  feet: "feet",
};

const WEAPON_WORDS: [RegExp, Weapon][] = [
  [/\bbattle ?axes?\b|\btwo[- ]?handed axes?\b/, "battleaxe"],
  [/\bgreatswords?\b|\btwo[- ]?handed swords?\b/, "greatsword"],
  [/\bmauls?\b|\btwo[- ]?handed (hammer|mace)s?\b/, "maul"],
  [/\b(inferno|flame|fire|destruction) staff\b/, "inferno"],
  [/\b(ice|frost) staff\b/, "ice"],
  [/\b(lightning|shock) staff\b/, "lightning"],
  [/\b(restoration|healing) staff\b/, "restoration"],
  [/\bshields?\b/, "shield"],
  [/\bbows?\b/, "bow"],
  [/\bdaggers?\b/, "dagger"],
  [/\baxes?\b/, "axe"],
  [/\b(maces?|hammers?)\b/, "mace"],
  [/\bswords?\b/, "sword"],
];

/**
 * Read a piece kind from what the addon writes: a type label ("Heavy Head",
 * "Ring", "Inferno Staff"), optionally with a separate weight. Returns null
 * for anything that isn't a piece (costumes, unknown labels).
 */
export function parsePieceType(type: string | null | undefined, weight?: string | null): PieceKind | null {
  const t = norm(type);
  if (!t) return null;
  if (/\b(necklace|amulet|neck)\b/.test(t)) return { kind: "jewelry", jewelry: "necklace" };
  if (/\bring\b/.test(t)) return { kind: "jewelry", jewelry: "ring" };
  const m = /^(light|medium|heavy)\s+(\w+)$/.exec(t);
  const w = (m?.[1] ?? norm(weight)) as Weight;
  const slot = SLOT_WORDS[m?.[2] ?? t];
  if (slot && (WEIGHTS as readonly string[]).includes(w)) return { kind: "armor", weight: w, slot };
  const weapon = WEAPON_WORDS.find(([re]) => re.test(t))?.[1];
  if (weapon) return { kind: "weapon", weapon };
  return null;
}

/**
 * Read a piece kind from an item or motif name by the game's piece words
 * ("Dwemer Helmet" is medium head, "Nord Battle Axe" a battle axe). For
 * names only; prefer parsePieceType when the addon gave a type.
 */
export function pieceKindFromName(name: string | null | undefined): PieceKind | null {
  const n = norm(name);
  if (!n) return null;
  for (const w of WEIGHTS) {
    for (const slot of ARMOR_SLOTS) {
      for (const word of PIECE_WORDS[w][slot]) {
        // Word boundaries keep "Helm" from matching inside "Helmet".
        if (new RegExp(`\\b${word.toLowerCase()}\\b`).test(n)) return { kind: "armor", weight: w, slot };
      }
    }
  }
  const weapon = WEAPON_WORDS.find(([re]) => re.test(n))?.[1];
  if (weapon) return { kind: "weapon", weapon };
  if (/\b(necklace|amulet)\b/.test(n)) return { kind: "jewelry", jewelry: "necklace" };
  if (/\bring\b/.test(n)) return { kind: "jewelry", jewelry: "ring" };
  return null;
}

/** A stable string key: "heavy-head", "ring", "greatsword". */
export function pieceKey(p: PieceKind): string {
  if (p.kind === "armor") return `${p.weight}-${p.slot}`;
  if (p.kind === "jewelry") return p.jewelry;
  return p.weapon;
}

export function pieceFromKey(key: string): PieceKind | null {
  const [a, b] = key.split("-");
  if (b && (WEIGHTS as readonly string[]).includes(a) && (ARMOR_SLOTS as readonly string[]).includes(b)) {
    return { kind: "armor", weight: a as Weight, slot: b as ArmorSlot };
  }
  if ((JEWELRY as readonly string[]).includes(key)) return { kind: "jewelry", jewelry: key as Jewelry };
  if ((WEAPONS as readonly string[]).includes(key)) return { kind: "weapon", weapon: key as Weapon };
  return null;
}

export function pieceLabel(p: PieceKind): string {
  if (p.kind === "armor") return `${WEIGHT_LABEL[p.weight]} ${SLOT_LABEL[p.slot]}`;
  if (p.kind === "jewelry") return JEWELRY_LABEL[p.jewelry];
  return WEAPON_LABEL[p.weapon];
}

/** Which station makes it (and researches its traits). */
export function craftOf(p: PieceKind): Craft {
  if (p.kind === "jewelry") return "jewelry";
  if (p.kind === "armor") return p.weight === "heavy" ? "blacksmithing" : "clothing";
  return p.weapon === "bow" || p.weapon === "shield" || STAVES.has(p.weapon) ? "woodworking" : "blacksmithing";
}

/** Which traits it can carry. Shields take armor traits. */
export function traitFamilyOf(p: PieceKind): TraitFamily {
  if (p.kind === "jewelry") return "jewelry";
  if (p.kind === "armor" || p.weapon === "shield") return "armor";
  return "weapon";
}

/**
 * Names a research line can carry for this piece, in the game's English.
 * The game names lines after the piece word ("Helm", "Robe", "Arm Cops") or
 * the weapon ("Battle Axe", "Inferno Staff"); this covers both.
 */
export function researchLineNames(p: PieceKind): string[] {
  if (p.kind === "armor") return PIECE_WORDS[p.weight][p.slot];
  if (p.kind === "jewelry") return p.jewelry === "necklace" ? ["Necklace", "Amulet"] : ["Ring"];
  const label = WEAPON_LABEL[p.weapon];
  return p.weapon === "inferno" ? [label, "Flame Staff", "Fire Staff"] : p.weapon === "ice" ? [label, "Frost Staff"] : [label];
}

/**
 * The piece a research line covers, from the game's line name ("Helm",
 * "Robe", "Robe & Jerkin", "Battle Axe", "Ring"). Piece words are unique
 * across weights, so the name alone is enough.
 */
export function pieceForResearchLine(lineName: string): PieceKind | null {
  const n = norm(lineName);
  const parts = n.split(/\s*[&/,]\s*|\s+and\s+/);
  for (const w of WEIGHTS) {
    for (const slot of ARMOR_SLOTS) {
      if (PIECE_WORDS[w][slot].some((word) => parts.includes(norm(word)))) return { kind: "armor", weight: w, slot };
    }
  }
  for (const weapon of WEAPONS) {
    const p: PieceKind = { kind: "weapon", weapon };
    if (researchLineNames(p).some((x) => norm(x) === n)) return p;
  }
  for (const j of JEWELRY) {
    const p: PieceKind = { kind: "jewelry", jewelry: j };
    if (researchLineNames(p).some((x) => norm(x) === n)) return p;
  }
  return null;
}

export function sameKind(a: PieceKind | null, b: PieceKind | null): boolean {
  return !!a && !!b && pieceKey(a) === pieceKey(b);
}

/* ------------------------------------------------------------------ */
/* Worn slots: where a piece sits on a character.                     */
/* ------------------------------------------------------------------ */

export type WornSlot =
  | ArmorSlot
  | "necklace"
  | "ring1"
  | "ring2"
  | "mainhand"
  | "offhand"
  | "poison";

export const WORN_SLOT_LABEL: Record<WornSlot, string> = {
  ...SLOT_LABEL,
  necklace: "Neck",
  ring1: "Ring 1",
  ring2: "Ring 2",
  mainhand: "Main hand",
  offhand: "Off hand",
  poison: "Poison",
};

/**
 * Read the addon's worn-slot label ("Head", "Hands", "Main Hand", "Back Off
 * Hand", "Ring 2"). "Hands" is armor: only "main hand" / "off hand" mean a
 * weapon slot.
 */
export function parseWornSlot(label: string | null | undefined): WornSlot | null {
  const n = norm(label).replace(/^(front|back|backup)\s+/, "");
  if (/\bpoison\b/.test(n)) return "poison";
  // Wizard's Wardrobe writes "Backup Main" / "Backup Off" for the back bar.
  if (/\bmain([ -]?hand)?\b/.test(n)) return "mainhand";
  if (/\boff([ -]?hand)?\b/.test(n)) return "offhand";
  if (/\bring\s*2\b|\bring2\b/.test(n)) return "ring2";
  if (/\bring\b/.test(n)) return "ring1";
  if (/\b(neck|necklace|amulet)\b/.test(n)) return "necklace";
  return SLOT_WORDS[n] ?? null;
}

export function isWeaponSlot(slot: WornSlot | null): boolean {
  return slot === "mainhand" || slot === "offhand" || slot === "poison";
}

/** Read a weapon from any text that names one (type, slot label, item name). */
export function weaponFromText(text: string | null | undefined): Weapon | null {
  const n = norm(text);
  return WEAPON_WORDS.find(([re]) => re.test(n))?.[1] ?? null;
}

/**
 * Words unique pieces use (mythics, monster masks, named and crafted
 * uniques): they name a slot but not a weight, so a name with only these
 * gives the slot and leaves the weight to the game's own type. Gathered
 * from real item names; extend when a new item shows another word.
 */
export const SLOT_ONLY_WORDS: Record<ArmorSlot, string[]> = {
  head: ["Mask", "Warmask", "Visage", "Circlet", "Cowl", "Hood", "Casque", "Coif", "Guise", "Visor", "Faceguard", "Greathelm", "Great Helm", "Crown", "Headdress", "Cap"],
  shoulders: ["Spaulder", "Shoulder", "Mantle"],
  chest: ["Breastplate", "Hauberk", "Shirt", "Coat", "Tunic", "Vest"],
  hands: ["Handwraps", "Wraps"],
  waist: ["Cinch", "Tassets"],
  legs: ["Chausses", "Pants", "Trousers", "Leggings"],
  feet: ["Sollerets", "Treaders", "Sandals"],
};

/** Jewelry words in item names. */
export const JEWELRY_WORDS: Record<Jewelry, string[]> = {
  necklace: ["Necklace", "Amulet", "Pendant", "Choker", "Torc"],
  ring: ["Ring"],
};

/** The game's slot labels ("Head", "Legs"); "Hand" alone is a weapon hand, not gloves. */
const SLOT_LABEL_WORDS: Record<ArmorSlot, string[]> = {
  head: ["Head"],
  shoulders: ["Shoulders"],
  chest: ["Chest"],
  hands: ["Hands"],
  waist: ["Waist"],
  legs: ["Legs"],
  feet: ["Feet", "Foot"],
};

/** A piece's slot, when a name or label gives the slot but maybe not the weight. */
export type PieceSlot =
  | { kind: "armor"; slot: ArmorSlot; weight: Weight | null }
  | { kind: "jewelry"; jewelry: Jewelry }
  | { kind: "weapon"; weapon: Weapon };

const wordRe = (word: string) => new RegExp(`\\b${word.toLowerCase().replace(/\s+/g, "\\s+")}s?\\b`);

/** Weighted words also seen in the singular on items ("Gauntlet" is still heavy hands). */
const SINGULAR_TOO = new Set(["Epaulets", "Gloves", "Bracers", "Boots", "Shoes", "Gauntlets", "Sabatons"]);
const weightedRe = (word: string) =>
  SINGULAR_TOO.has(word) ? new RegExp(`\\b${word.toLowerCase().slice(0, -1)}s?\\b`) : wordRe(word);

/**
 * Every piece word the game uses, in the order a text is read: armor slots
 * (weighted words first, so the weight comes along), then jewelry, then
 * weapons as WEAPON_WORDS orders them.
 */
const SLOT_READERS: [RegExp, PieceSlot][] = [
  ...(["shoulders", "head", "chest", "hands", "waist", "legs", "feet"] as const).flatMap((slot) => [
    ...WEIGHTS.flatMap((weight) =>
      PIECE_WORDS[weight][slot].map((word): [RegExp, PieceSlot] => [weightedRe(word), { kind: "armor", slot, weight }]),
    ),
    ...[...SLOT_ONLY_WORDS[slot], ...SLOT_LABEL_WORDS[slot]].map((word): [RegExp, PieceSlot] => [
      wordRe(word),
      { kind: "armor", slot, weight: null },
    ]),
  ]),
  ...(Object.keys(JEWELRY_WORDS) as Jewelry[]).flatMap((jewelry) =>
    [...JEWELRY_WORDS[jewelry], jewelry === "necklace" ? "Neck" : "Ring"].map((word): [RegExp, PieceSlot] => [
      wordRe(word),
      { kind: "jewelry", jewelry },
    ]),
  ),
  ...WEAPON_WORDS.map(([re, weapon]): [RegExp, PieceSlot] => [re, { kind: "weapon", weapon }]),
];

/**
 * The slot a name or label names, by the game's piece words: "Spaulder of
 * Ruin" is shoulders of no stated weight, "Null Arca Guards" medium legs,
 * "Ring 1" a ring. Null when no piece word appears; a set name alone never
 * picks a slot.
 */
export function pieceSlotFromText(text: string | null | undefined): PieceSlot | null {
  const n = norm(text);
  if (!n) return null;
  return SLOT_READERS.find(([re]) => re.test(n))?.[1] ?? null;
}

/** A label that names only a weapon hand: "two-handed" or "one-handed" (Main Hand, Off Hand). */
export function weaponHandFromText(text: string | null | undefined): "one" | "two" | null {
  const n = norm(text);
  if (/\b(two[- ]?hand(ed)?|staff|staves)\b/.test(n)) return "two";
  if (/\b(main hand|off hand|one[- ]?hand(ed)?)\b/.test(n)) return "one";
  return null;
}

/** Every piece word, lowercase, longest first: for telling a set name from the piece word after it. */
export const ALL_PIECE_WORDS: readonly string[] = [
  ...new Set(
    [
      ...WEIGHTS.flatMap((w) => ARMOR_SLOTS.flatMap((s) => PIECE_WORDS[w][s])),
      ...ARMOR_SLOTS.flatMap((s) => SLOT_ONLY_WORDS[s]),
      ...[...SINGULAR_TOO].map((w) => w.slice(0, -1)),
      "Shoulders",
      ...Object.values(JEWELRY_WORDS).flat(),
      ...Object.values(WEAPON_LABEL),
      "Battleaxe",
      "Frost Staff",
      "Healing Staff",
      "Fire Staff",
      "Staff",
    ]
      .map((w) => w.toLowerCase())
      // Plurals too ("Spaulders"); words already ending in s stay as they are.
      .flatMap((w) => (w.endsWith("s") ? [w] : [w, `${w}s`])),
  ),
].sort((a, b) => b.length - a.length || a.localeCompare(b));
