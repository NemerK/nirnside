import { classIcon } from "../classes";
import { isClassMasteryLineName } from "../skills/class-mastery";
import { resolveSkillIcon } from "./skill-icons";

/**
 * Planner art. An in-game catalog icon wins. Otherwise we only use files that
 * were checked against the icon proxy: weapon-line progression art, class
 * crests, the community skill-name map, and status icons whose filename is
 * that exact status. Combined scripts such as "Brutality and Sorcery" stay
 * blank — one half of the pair is the wrong picture.
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
 * Exact script name → texture. Affixes match one major buff or debuff.
 * Flame, frost, and shock match the staff art for that element. Stun and
 * knockback match those status icons. Everything else is left unset.
 */
const SCRIPT_ICONS: Record<string, string> = {
  berserk: "esoui/art/icons/ability_buff_major_berserk.dds",
  breach: "esoui/art/icons/ability_debuff_major_breach.dds",
  brittle: "esoui/art/icons/ability_debuff_major_brittle.dds",
  courage: "esoui/art/icons/ability_buff_major_courage.dds",
  cowardice: "esoui/art/icons/ability_debuff_major_cowardice.dds",
  defile: "esoui/art/icons/ability_debuff_major_defile.dds",
  empower: "esoui/art/icons/ability_buff_major_empower.dds",
  enervation: "esoui/art/icons/ability_debuff_major_enervation.dds",
  evasion: "esoui/art/icons/ability_buff_major_evasion.dds",
  expedition: "esoui/art/icons/ability_buff_major_expedition.dds",
  force: "esoui/art/icons/ability_buff_major_force.dds",
  heroism: "esoui/art/icons/ability_buff_major_heroism.dds",
  lifesteal: "esoui/art/icons/ability_buff_major_lifesteal.dds",
  magickasteal: "esoui/art/icons/ability_buff_major_magickasteal.dds",
  maim: "esoui/art/icons/ability_debuff_major_maim.dds",
  mangle: "esoui/art/icons/ability_debuff_major_mangle.dds",
  "off balance": "esoui/art/icons/ability_debuff_offbalance.dds",
  protection: "esoui/art/icons/ability_buff_major_protection.dds",
  resolve: "esoui/art/icons/ability_buff_major_resolve.dds",
  uncertainty: "esoui/art/icons/ability_debuff_major_uncertainty.dds",
  vitality: "esoui/art/icons/ability_buff_major_vitality.dds",
  vulnerability: "esoui/art/icons/ability_debuff_major_vulnerability.dds",
  stun: "esoui/art/icons/ability_debuff_stun.dds",
  knockback: "esoui/art/icons/ability_debuff_knockback.dds",
  "flame damage": "esoui/art/progression/icon_firestaff.dds",
  "frost damage": "esoui/art/progression/icon_icestaff.dds",
  "shock damage": "esoui/art/progression/icon_lightningstaff.dds",
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

export function plannerScriptIcon(name: string): string | null {
  return SCRIPT_ICONS[name.trim().toLowerCase()] ?? null;
}
