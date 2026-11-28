import type { BarSkill, Character } from "../snapshot/schema";
import { readStats, type StatsReading } from "./stats";
import { allianceFit, findRace, type AllianceFit } from "./character";
import { championState, type ConstellationState } from "./champion";
import { classLineup, classMasteryAvailable, type ClassLineup } from "./classes";
import { WEIGHTS, type Weapon, type Weight } from "./equipment";
import { loadoutOf, type Loadout } from "./loadout";
import { idleResearchSlots } from "./research";
import { ARMOR_LINES, readBar, type BarReading } from "./weapon-lines";
import type { FactSource } from "./addons";
import { readAccountCompanions, readCompanion, type CompanionInput, type CompanionReading } from "./companions";
import { recipeFamily, type RecipeFamily } from "./food";
import { styleKnowledge, type StyleKnowledge } from "./motifs";
import { readMundus, type MundusReading, type MundusText } from "./mundus";
import { readBuffs, type BuffReading } from "./buffs";
import { readRiding, type RidingReading } from "./riding";
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
 * mundus → the blessings with the game's own text, Twice-Born Star, Divines pieces;
 * buffs, riding, skill points, backpack space → as of the save, counted down;
 * motifs → which styles and chapters it can craft in;
 * recipes → which food and drink families it can cook;
 * companions → level, ultimate, theme;
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
  provenance: Record<
    "identity" | "skills" | "gear" | "champion" | "research" | "motifs" | "recipes" | "companions" | "setups",
    FactSource
  >;
  /**
   * Wizard's Wardrobe setups (a third-party addon's record of the player's
   * plans), each read against the game model. Empty without the addon.
   */
  setups: { zone: string; page: string; setup: string; reading: SetupReading }[];
  /** Mundus blessings with the game's own text, how many the gear allows, and the Divines pieces. */
  mundus: MundusReading;
  /** Lasting buffs at the save, counted down to now. Empty before addon 0.9.43. */
  buffs: BuffReading[];
  /** Riding lessons and when the next one opens. Null before addon 0.9.43. */
  riding: RidingReading | null;
  /** Unspent skill points at the save. */
  skillPoints: number | null;
  /** Skyshard pieces toward the next skill point at the save (GetNumSkyShards). */
  skyshards: number | null;
  /** Backpack slots used and total at the save. */
  backpack: { used: number; size: number } | null;
  /** The character sheet at the save, worded as the game's window. Null before snapshot 0.9.46. */
  stats: StatsReading | null;
  /** The skills slotted on each bar at the save, with each one's skill line. Null before snapshot 0.9.46. */
  skillBars: { bar: "front" | "back"; skills: (BarSkill & { line: string | null })[] }[] | null;
  /** Motif knowledge per style: complete books and known chapters. */
  styles: StyleKnowledge[];
  /** Provisioning recipe families this character knows recipes in, with what they boost. */
  recipeFamilies: { family: RecipeFamily; known: number; total: number }[];
  /** The account's companions (shared by every character), or an older save's per-character list. */
  companions: CompanionReading[];
}

/** What else a reading can use: the game's own Mundus text, and the account's companions. */
export interface GameKnowledge {
  mundus?: readonly MundusText[];
  /** The account's companions (account-wide since addon 0.9.43). */
  companions?: readonly (CompanionInput & { owned?: boolean | null })[];
}

export function readCharacter(
  c: Character,
  classLines: Map<string, string[]>,
  abilityLines: Map<string, string> = new Map(),
  knowledge: GameKnowledge = {},
  now: number = Math.floor(Date.now() / 1000),
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
      motifs: "game",
      recipes: "game",
      companions: "game",
      setups: "addon",
    },
    mundus: readMundus(c, c.equipped, knowledge.mundus ?? []),
    buffs: readBuffs(c.buffs, now),
    riding: readRiding(c.riding, now),
    skillPoints: c.skillPoints ?? null,
    skyshards: c.skyshards ?? null,
    backpack: c.backpack ?? null,
    stats: readStats(c.stats),
    skillBars: c.bars
      ? c.bars.map((b) => ({
          bar: b.bar,
          skills: b.skills.map((s) => ({ ...s, line: (s.name && abilityLines.get(s.name.trim().toLowerCase())) || null })),
        }))
      : null,
    styles: c.motifs.map(styleKnowledge),
    recipeFamilies: c.recipeLists
      .filter((l) => l.kind === "provisioning")
      .flatMap((l) => {
        const family = recipeFamily(l.name);
        return family ? [{ family, known: l.known, total: l.total }] : [];
      }),
    // Companions are account-wide; older saves kept a per-character list instead.
    companions: knowledge.companions?.length ? readAccountCompanions(knowledge.companions) : c.companions.map(readCompanion),
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
