import type { Character } from "../snapshot/schema";
import { allianceFit, findRace, type AllianceFit } from "./character";
import { championState, type ConstellationState } from "./champion";
import { classLineup, classMasteryAvailable, type ClassLineup } from "./classes";
import { WEIGHTS, type Weapon, type Weight } from "./equipment";
import { loadoutOf, type Loadout } from "./loadout";
import { idleResearchSlots } from "./research";
import { ARMOR_LINES, readBar, type BarReading } from "./weapon-lines";

/**
 * One character, read through every system the model knows, so any page
 * or feature asks one place and gets the same answer:
 *
 * race and alliance → what that says about the account;
 * class lines → own, borrowed, swapped out, and whether Class Mastery applies;
 * worn gear → sets per bar, armor per weight and the armor lines it feeds,
 *   and which weapon line each bar's weapons make;
 * Champion Points → spent, slotted, free slots per constellation;
 * research → idle slots per craft.
 */
export interface CharacterReading {
  race: string | null;
  alliance: string;
  allianceFit: AllianceFit;
  lineup: ClassLineup;
  classMastery: boolean;
  loadout: Loadout;
  bars: { front: BarReading; back: BarReading };
  /** Body pieces per weight, and the armor line each weight levels. */
  armor: { weight: Weight; pieces: number; line: string }[];
  champion: ConstellationState[];
  idleResearch: Partial<Record<string, number>>;
}

export function readCharacter(c: Character, classLines: Map<string, string[]>): CharacterReading {
  const loadout = loadoutOf(c.equipped);
  const weaponOn = (bar: "front" | "back", slot: "mainhand" | "offhand"): Weapon | null => {
    const p = loadout.pieces.find((x) => x.bar === bar && x.slot === slot);
    return p?.kind?.kind === "weapon" ? p.kind.weapon : null;
  };
  const lineup = classLineup(c.class, c.skillLines, classLines);
  return {
    race: findRace(c.race)?.name ?? (c.race || null),
    alliance: c.alliance,
    allianceFit: allianceFit(c.race, c.alliance),
    lineup,
    classMastery: classMasteryAvailable(lineup),
    loadout,
    bars: {
      front: readBar(weaponOn("front", "mainhand"), weaponOn("front", "offhand")),
      back: readBar(weaponOn("back", "mainhand"), weaponOn("back", "offhand")),
    },
    armor: WEIGHTS.map((weight) => ({ weight, pieces: loadout.armorWeights[weight], line: ARMOR_LINES[weight] })),
    champion: championState(c.champion),
    idleResearch: idleResearchSlots(c.research),
  };
}
