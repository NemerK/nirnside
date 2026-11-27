import type { Character } from "../snapshot/schema";
import { allianceFit, findRace, type AllianceFit } from "./character";
import { championState, type ConstellationState } from "./champion";
import { classLineup, classMasteryAvailable, type ClassLineup } from "./classes";
import { WEIGHTS, type Weapon, type Weight } from "./equipment";
import { loadoutOf, type Loadout } from "./loadout";
import { idleResearchSlots } from "./research";
import { ARMOR_LINES, readBar, type BarReading } from "./weapon-lines";
import type { FactSource } from "./addons";
import { readSetup, type SetupReading } from "./setups";

/**
 * One character, read through every system the model knows, so any page
 * or feature asks one place and gets the same answer:
 *
 * race and alliance → what that says about the account;
 * class lines → own, borrowed, swapped out, and whether Class Mastery applies;
 * worn gear → sets per bar, armor per weight and the armor lines it feeds,
 *   and which weapon line each bar's weapons make;
 * Champion Points → spent, slotted, free slots per constellation;
 * research → idle slots per craft;
 * Wizard's Wardrobe setups → each plan's weapon lines, skills its bars
 *   can't use, and how far the worn gear is from it;
 * and for each part, where it comes from and when it was saved.
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
  /** When the game last saved this character (logout or reload), in unix seconds. */
  savedAt: number | null;
  /**
   * Where each part comes from. Everything is "as of savedAt": addons only
   * write their data at a reload, zone change, logout or quit.
   */
  provenance: Record<"identity" | "skills" | "gear" | "champion" | "research" | "setups", FactSource>;
  /**
   * Wizard's Wardrobe setups (a third-party addon's record of the player's
   * plans), each read against the game model. Empty without the addon.
   */
  setups: { zone: string; page: string; setup: string; reading: SetupReading }[];
}

export function readCharacter(
  c: Character,
  classLines: Map<string, string[]>,
  abilityLines: Map<string, string> = new Map(),
): CharacterReading {
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
    savedAt: c.lastSeen ?? null,
    provenance: {
      identity: "game",
      skills: "game",
      gear: "game",
      champion: "game",
      research: "game",
      setups: "addon",
    },
    setups: (c.wardrobe?.zones ?? []).flatMap((z) =>
      z.pages.flatMap((p) =>
        p.setups.map((setup) => ({
          zone: z.name || z.tag,
          page: p.name,
          setup: setup.name,
          reading: readSetup(setup, c, (name) => abilityLines.get(name.trim().toLowerCase()) ?? null),
        })),
      ),
    ),
  };
}
