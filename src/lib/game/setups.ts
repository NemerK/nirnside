import type { Character, WardrobeSetup } from "../snapshot/schema";
import { parseWornSlot, pieceKindFromName, type Weapon, type WornSlot } from "./equipment";
import { barWeaponLine, isWeaponLine, lineUsableOnBar, type WeaponLine } from "./weapon-lines";

/**
 * A Wizard's Wardrobe setup, read against the game model. A setup is the
 * player's plan (another addon's record), so it is compared with what the
 * game says the character wears rather than trusted as the current state.
 */

type Bar = "front" | "back";

function barOf(slotLabel: string): Bar | null {
  const slot = parseWornSlot(slotLabel);
  if (slot !== "mainhand" && slot !== "offhand" && slot !== "poison") return null;
  return /back/i.test(slotLabel) ? "back" : "front";
}

function key(slotLabel: string): string {
  const slot = parseWornSlot(slotLabel) ?? slotLabel.toLowerCase();
  const bar = barOf(slotLabel);
  return bar ? `${bar}:${slot}` : String(slot);
}

export interface SetupReading {
  /** The weapon line each of the setup's bars makes. */
  weaponLines: Record<Bar, WeaponLine | null>;
  /** Setup skills from a weapon line its own bar can't use (wrong weapons for that bar). */
  misplacedSkills: { bar: Bar; skill: string; line: WeaponLine }[];
  /** Gear in the setup that differs from what the character wears now, per slot. */
  gearDiff: { slot: string; planned: string; worn: string | null }[];
  /** Whether the character is wearing this setup (every planned piece in place). */
  wornNow: boolean;
}

/**
 * Read a setup: its bars' weapon lines, skills its bars can't use, and how
 * far the worn gear is from it. `lineOfAbility` maps an ability to its skill
 * line (from the catalog); unknown abilities are left alone.
 */
export function readSetup(
  setup: WardrobeSetup,
  character: Pick<Character, "equipped">,
  lineOfAbility: (name: string) => string | null,
): SetupReading {
  const weapons: Record<Bar, { main: Weapon | null; off: Weapon | null }> = {
    front: { main: null, off: null },
    back: { main: null, off: null },
  };
  for (const g of setup.gear) {
    const bar = barOf(g.slot);
    const slot: WornSlot | null = parseWornSlot(g.slot);
    const kind = pieceKindFromName(g.name);
    if (!bar || kind?.kind !== "weapon") continue;
    if (slot === "mainhand") weapons[bar].main = kind.weapon;
    if (slot === "offhand") weapons[bar].off = kind.weapon;
  }
  const weaponLines = {
    front: barWeaponLine(weapons.front.main, weapons.front.off),
    back: barWeaponLine(weapons.back.main, weapons.back.off),
  };

  const misplacedSkills: SetupReading["misplacedSkills"] = [];
  for (const b of setup.bars) {
    for (const s of b.skills) {
      const line = s.name ? lineOfAbility(s.name) : null;
      if (!line || !isWeaponLine(line)) continue;
      if (!lineUsableOnBar(line, weapons[b.bar].main, weapons[b.bar].off)) misplacedSkills.push({ bar: b.bar, skill: s.name, line });
    }
  }

  const worn = new Map(character.equipped.map((e) => [key(e.bar === "back" ? `Back ${e.slot}` : e.slot), e.name]));
  const gearDiff = setup.gear
    .filter((g) => g.name && !/poison/i.test(g.slot))
    .map((g) => ({ slot: g.slot, planned: g.name, worn: worn.get(key(g.slot)) ?? null }))
    .filter((d) => (d.worn ?? "").trim().toLowerCase() !== d.planned.trim().toLowerCase());

  return { weaponLines, misplacedSkills, gearDiff, wornNow: setup.gear.length > 0 && gearDiff.length === 0 };
}
