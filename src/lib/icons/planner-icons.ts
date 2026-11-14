import { classIcon } from "../classes";
import { isClassMasteryLineName } from "../skills/class-mastery";
import { resolveSkillIcon } from "./skill-icons";

/**
 * Planner art. An in-game catalog icon wins. Otherwise we only use files that
 * were checked against the icon proxy: weapon-line progression art, class
 * crests, the community skill-name map, and the scribing textures
 * GetCraftedAbilityScriptIcon returns. Those are the ink icons in the scribing
 * window, not the major-buff icons the effect happens to grant.
 */

/**
 * Weapon-line art confirmed by looking at the file.
 * Sword-and-board, greatsword, bow, and dual swords are the progression icons.
 * The staff lines use the base staff ability art: a lightning-tipped staff, and
 * a healing figure. Fire-only staff art is not used for the whole Destruction
 * Staff line.
 */
const WEAPON_LINE_ICONS: Record<string, string> = {
  "one hand and shield": "esoui/art/progression/icon_1handed.dds",
  "two handed": "esoui/art/progression/icon_2handed.dds",
  bow: "esoui/art/progression/icon_bows.dds",
  "dual wield": "esoui/art/progression/icon_dualwield.dds",
  "destruction staff": "esoui/art/icons/ability_destructionstaff_001.dds",
  "restoration staff": "esoui/art/icons/ability_restorationstaff_001.dds",
};

/**
 * Exact script name → the texture the scribing window shows for that script.
 * A few files keep the internal effect name rather than the script's title:
 * Physical Damage is increasedamage, Mitigation is transferbuff.
 */
const SCRIPT_ICONS: Record<string, string> = {
  "bleed damage": "esoui/art/icons/scribing_primary_bleeding.dds",
  "damage shield": "esoui/art/icons/scribing_primary_damageshield.dds",
  "disease damage": "esoui/art/icons/scribing_primary_disease.dds",
  dispel: "esoui/art/icons/scribing_primary_dispelled.dds",
  "flame damage": "esoui/art/icons/scribing_primary_flame.dds",
  "frost damage": "esoui/art/icons/scribing_primary_frost.dds",
  "generate ultimate": "esoui/art/icons/scribing_primary_gainultimate.dds",
  healing: "esoui/art/icons/scribing_primary_healing.dds",
  immobilize: "esoui/art/icons/scribing_primary_immobilized.dds",
  knockback: "esoui/art/icons/scribing_primary_knockback.dds",
  "magic damage": "esoui/art/icons/scribing_primary_magicka.dds",
  mitigation: "esoui/art/icons/scribing_primary_transferbuff.dds",
  "multi-target": "esoui/art/icons/scribing_primary_multihit.dds",
  "physical damage": "esoui/art/icons/scribing_primary_increasedamage.dds",
  "poison damage": "esoui/art/icons/scribing_primary_poison.dds",
  pull: "esoui/art/icons/scribing_primary_pull.dds",
  "restore resources": "esoui/art/icons/scribing_primary_resourcerestore.dds",
  "shock damage": "esoui/art/icons/scribing_primary_shock.dds",
  stun: "esoui/art/icons/scribing_primary_stunned.dds",
  taunt: "esoui/art/icons/scribing_primary_taunt.dds",
  trauma: "esoui/art/icons/scribing_primary_trauma.dds",

  "anchorite's cruelty": "esoui/art/icons/scribing_secondary_soulcollapse.dds",
  "anchorite's potency": "esoui/art/icons/scribing_secondary_giveultimate.dds",
  "assassin's misery": "esoui/art/icons/scribing_secondary_statuseffect.dds",
  "cavalier's charge": "esoui/art/icons/scribing_secondary_chargedamage.dds",
  "class flourish": "esoui/art/icons/scribing_secondary_classmod.dds",
  "crusader's defiance": "esoui/art/icons/scribing_secondary_breaksnare.dds",
  "druid's resurgence": "esoui/art/icons/scribing_secondary_resourcerestore.dds",
  "fencer's parry": "esoui/art/icons/scribing_secondary_bladeturn.dds",
  "gladiator's tenacity": "esoui/art/icons/scribing_secondary_damagereduction.dds",
  "growing impact": "esoui/art/icons/scribing_secondary_localaoedamagebuff.dds",
  "hunter's snare": "esoui/art/icons/scribing_secondary_snare.dds",
  "immobilizing strike": "esoui/art/icons/scribing_secondary_immobilize.dds",
  "knight's valor": "esoui/art/icons/scribing_secondary_shieldmastery.dds",
  "leeching thirst": "esoui/art/icons/scribing_secondary_livesteal.dds",
  "lingering torment": "esoui/art/icons/scribing_secondary_damageovertime.dds",
  "sage's remedy": "esoui/art/icons/scribing_secondary_healovertime.dds",
  "thief's swiftness": "esoui/art/icons/scribing_secondary_mobility.dds",
  "warmage's defense": "esoui/art/icons/scribing_secondary_damageshield.dds",
  "warrior's opportunity": "esoui/art/icons/scribing_secondary_opportunism.dds",
  "wayfarer's mastery": "esoui/art/icons/scribing_secondary_battletechnique.dds",

  berserk: "esoui/art/icons/scribing_tertiary_berserk.dds",
  breach: "esoui/art/icons/scribing_tertiary_breach.dds",
  brittle: "esoui/art/icons/scribing_tertiary_brittle.dds",
  "brutality and sorcery": "esoui/art/icons/scribing_tertiary_brutalitysorcery.dds",
  courage: "esoui/art/icons/scribing_tertiary_courage.dds",
  cowardice: "esoui/art/icons/scribing_tertiary_cowardice.dds",
  defile: "esoui/art/icons/scribing_tertiary_defile.dds",
  empower: "esoui/art/icons/scribing_tertiary_empower.dds",
  enervation: "esoui/art/icons/scribing_tertiary_enervation.dds",
  evasion: "esoui/art/icons/scribing_tertiary_evasion.dds",
  expedition: "esoui/art/icons/scribing_tertiary_expedition.dds",
  force: "esoui/art/icons/scribing_tertiary_force.dds",
  heroism: "esoui/art/icons/scribing_tertiary_heroism.dds",
  "intellect and endurance": "esoui/art/icons/scribing_tertiary_intellectendurance.dds",
  interrupt: "esoui/art/icons/scribing_tertiary_interrupt.dds",
  lifesteal: "esoui/art/icons/scribing_tertiary_lifesteal.dds",
  magickasteal: "esoui/art/icons/scribing_tertiary_magickasteal.dds",
  maim: "esoui/art/icons/scribing_tertiary_maim.dds",
  mangle: "esoui/art/icons/scribing_tertiary_mangle.dds",
  "off balance": "esoui/art/icons/scribing_tertiary_offbalance.dds",
  protection: "esoui/art/icons/scribing_tertiary_protection.dds",
  resolve: "esoui/art/icons/scribing_tertiary_resolve.dds",
  "savagery and prophecy": "esoui/art/icons/scribing_tertiary_savageprophecy.dds",
  uncertainty: "esoui/art/icons/scribing_tertiary_uncertainty.dds",
  vitality: "esoui/art/icons/scribing_tertiary_vitality.dds",
  vulnerability: "esoui/art/icons/scribing_tertiary_vulnerability.dds",
};

/** Grimoire name → the icon every skill scribed from that grimoire shares. */
const GRIMOIRE_ICONS: Record<string, string> = {
  "shield throw": "esoui/art/icons/ability_grimoire_1handed.dds",
  smash: "esoui/art/icons/ability_grimoire_2handed.dds",
  trample: "esoui/art/icons/ability_grimoire_assault.dds",
  vault: "esoui/art/icons/ability_grimoire_bow.dds",
  "traveling knife": "esoui/art/icons/ability_grimoire_dualwield.dds",
  torchbearer: "esoui/art/icons/ability_grimoire_fightersguild.dds",
  "ulfsild's contingency": "esoui/art/icons/ability_grimoire_magesguild.dds",
  "wield soul": "esoui/art/icons/ability_grimoire_soulmagic1.dds",
  "soul burst": "esoui/art/icons/ability_grimoire_soulmagic2.dds",
  "elemental explosion": "esoui/art/icons/ability_grimoire_staffdestro.dds",
  "mender's bond": "esoui/art/icons/ability_grimoire_staffresto.dds",
  "banner bearer": "esoui/art/icons/ability_grimoire_support.dds",
};

function clean(icon: string | null | undefined): string | null {
  const value = icon?.trim();
  return value ? value : null;
}

export function plannerAbilityIcon(input: {
  name: string;
  morphNames?: readonly (string | null | undefined)[];
  catalogIcon?: string | null;
  lineName?: string | null;
  className?: string | null;
}): string | null {
  const catalog = clean(input.catalogIcon);
  if (catalog) return catalog;
  const mapped = resolveSkillIcon(input.name, [...(input.morphNames ?? [])]);
  if (mapped) return mapped;
  if (input.lineName && isClassMasteryLineName(input.lineName) && input.className) {
    return classIcon(input.className) ?? null;
  }
  return null;
}

export function plannerLineIcon(input: {
  name: string;
  className?: string | null;
  catalogIcon?: string | null;
  abilityIcon?: string | null;
}): string | null {
  const catalog = clean(input.catalogIcon);
  if (catalog) return catalog;
  const weapon = WEAPON_LINE_ICONS[input.name.trim().toLowerCase()];
  if (weapon) return weapon;
  if (isClassMasteryLineName(input.name) && input.className) {
    return classIcon(input.className) ?? null;
  }
  return clean(input.abilityIcon);
}

export function plannerScriptIcon(name: string, catalogIcon?: string | null): string | null {
  const catalog = clean(catalogIcon);
  if (catalog) return catalog;
  return SCRIPT_ICONS[name.trim().toLowerCase()] ?? null;
}

export function plannerGrimoireIcon(name: string, catalogIcon?: string | null): string | null {
  const catalog = clean(catalogIcon);
  if (catalog) return catalog;
  return GRIMOIRE_ICONS[name.trim().toLowerCase()] ?? null;
}
