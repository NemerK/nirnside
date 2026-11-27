import { STAVES, TWO_HANDED, type Weapon, type Weight } from "./equipment";

/**
 * Weapon and armor skill lines and what they need equipped. Sources: UESP
 * Online:Weapons, Online:Dual_Wield, Online:Two_Handed, Online:Skills.
 *
 * - Six weapon skill lines. One-handed weapons (axe, mace, sword, dagger)
 *   go in either hand: two of them is Dual Wield, one with a shield is One
 *   Hand and Shield. A lone one-hander matches no line.
 * - Two Handed: greatsword, battle axe, maul. Bow. Destruction Staff:
 *   inferno, ice or lightning. Restoration Staff.
 * - A weapon line's active abilities can only be cast, and its passives
 *   only work, while that bar holds the matching weapons. Each bar has five
 *   ability slots and an ultimate; weapon swapping (two bars) opens at
 *   level 15.
 * - Some passives read the exact weapons: Dual Wield's Twin Blade and
 *   Blunt and Two Handed's Heavy Weapons give a different bonus per weapon
 *   type (axe, mace, sword, dagger), Destruction Staff passives per element.
 * - Armor lines (Light, Medium, Heavy) level, and their passives scale,
 *   with the number of body pieces of that weight worn.
 */

// Same order as the Skills window (SKILL_WINDOW_LINE_ORDER.Weapon).
export const WEAPON_LINES = [
  "Two Handed",
  "One Hand and Shield",
  "Dual Wield",
  "Bow",
  "Destruction Staff",
  "Restoration Staff",
] as const;
export type WeaponLine = (typeof WEAPON_LINES)[number];

export const ARMOR_LINES: Record<Weight, string> = {
  light: "Light Armor",
  medium: "Medium Armor",
  heavy: "Heavy Armor",
};

export const ONE_HANDED: ReadonlySet<Weapon> = new Set(["axe", "mace", "sword", "dagger"]);

export type Element = "fire" | "frost" | "shock";
const ELEMENT: Partial<Record<Weapon, Element>> = { inferno: "fire", ice: "frost", lightning: "shock" };

/** The weapon line a bar's weapons make, or null when they make none (a lone one-hander, an empty bar). */
export function barWeaponLine(main: Weapon | null, off: Weapon | null): WeaponLine | null {
  if (main && TWO_HANDED.has(main)) {
    if (main === "bow") return "Bow";
    if (main === "restoration") return "Restoration Staff";
    if (STAVES.has(main)) return "Destruction Staff";
    return "Two Handed";
  }
  const hands = [main, off].filter((w): w is Weapon => !!w);
  const oneHanders = hands.filter((w) => ONE_HANDED.has(w));
  if (oneHanders.length === 2) return "Dual Wield";
  if (oneHanders.length === 1 && hands.includes("shield")) return "One Hand and Shield";
  return null;
}

/** What a weapon line needs on the bar, in words. */
export const LINE_NEEDS: Record<WeaponLine, string> = {
  "Two Handed": "A greatsword, battle axe or maul",
  "One Hand and Shield": "A one-handed weapon and a shield",
  "Dual Wield": "Two one-handed weapons (axe, mace, sword or dagger), one in each hand",
  Bow: "A bow",
  "Destruction Staff": "An inferno, ice or lightning staff",
  "Restoration Staff": "A restoration staff",
};

export interface BarReading {
  line: WeaponLine | null;
  /** Per-weapon-type count, for passives that read the exact weapons (Twin Blade and Blunt, Heavy Weapons). */
  types: Partial<Record<Weapon, number>>;
  /** The destruction element, for staff passives and morph behaviour. */
  element: Element | null;
}

export function readBar(main: Weapon | null, off: Weapon | null): BarReading {
  const types: Partial<Record<Weapon, number>> = {};
  for (const w of [main, off]) if (w && w !== "shield") types[w] = (types[w] ?? 0) + 1;
  return { line: barWeaponLine(main, off), types, element: main ? (ELEMENT[main] ?? null) : null };
}

/** Can an ability from this skill line be used on a bar holding these weapons? Non-weapon lines always can. */
export function lineUsableOnBar(lineName: string, main: Weapon | null, off: Weapon | null): boolean {
  const line = WEAPON_LINES.find((l) => l.toLowerCase() === lineName.trim().toLowerCase());
  if (!line) return true;
  return barWeaponLine(main, off) === line;
}

/** Is this one of the weapon lines? */
export function isWeaponLine(name: string): name is WeaponLine {
  return WEAPON_LINES.some((l) => l.toLowerCase() === name.trim().toLowerCase());
}

/** The armor line a weight levels. */
export function armorLineFor(weight: Weight): string {
  return ARMOR_LINES[weight];
}
