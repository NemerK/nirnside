import { CLASSES, type ClassName } from "./game/classes";

/**
 * How each class looks in Nirnside: its crest and color. Which classes
 * exist is the game model's (game/classes.ts CLASSES).
 */

/**
 * In-game class crest per class, served through our icon proxy.
 * The keyboard set (`class_<name>.dds`) is 32×32 and turns into blocks
 * when the profile draws it large. The gamepad set is the same symbol at
 * 64×64, which is the sharpest class crest the game ships.
 */
export const CLASS_ICONS: Record<ClassName, string> = {
  Dragonknight: "/esoui/art/icons/class/gamepad/gp_class_dragonknight.dds",
  Sorcerer: "/esoui/art/icons/class/gamepad/gp_class_sorcerer.dds",
  Nightblade: "/esoui/art/icons/class/gamepad/gp_class_nightblade.dds",
  Templar: "/esoui/art/icons/class/gamepad/gp_class_templar.dds",
  Warden: "/esoui/art/icons/class/gamepad/gp_class_warden.dds",
  Necromancer: "/esoui/art/icons/class/gamepad/gp_class_necromancer.dds",
  Arcanist: "/esoui/art/icons/class/gamepad/gp_class_arcanist.dds",
};

export function classIcon(className: string): string | undefined {
  return CLASS_ICONS[className as ClassName];
}

/**
 * Class hues from the game: fire, storm, shadow, sun, green, grave, and
 * Apocrypha. Kept distinct so two classes never share a color.
 */
export const CLASS_COLORS: Record<ClassName, string> = {
  Dragonknight: "#e06a3a",
  Sorcerer: "#5b9fe8",
  Nightblade: "#b46ad4",
  Templar: "#e0c04a",
  Warden: "#3eaf62",
  Necromancer: "#8fbf7a",
  Arcanist: "#2fbfb0",
};

export function classColor(className: string): string | undefined {
  return CLASS_COLORS[className as ClassName];
}

/** Live classes first, then any extra names a snapshot still carries. */
export function classFilterOrder(present: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...CLASSES, ...present]) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
