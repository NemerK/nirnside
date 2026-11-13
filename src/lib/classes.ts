/** Live ESO classes, in character-create order. */
export const ESO_CLASSES = [
  "Dragonknight",
  "Sorcerer",
  "Nightblade",
  "Templar",
  "Warden",
  "Necromancer",
  "Arcanist",
] as const;

export type EsoClass = (typeof ESO_CLASSES)[number];

/** In-game class icon (.dds) per class, served through our icon proxy. */
export const CLASS_ICONS: Record<string, string> = {
  Dragonknight: "/esoui/art/icons/class/class_dragonknight.dds",
  Sorcerer: "/esoui/art/icons/class/class_sorcerer.dds",
  Nightblade: "/esoui/art/icons/class/class_nightblade.dds",
  Templar: "/esoui/art/icons/class/class_templar.dds",
  Warden: "/esoui/art/icons/class/class_warden.dds",
  Necromancer: "/esoui/art/icons/class/class_necromancer.dds",
  Arcanist: "/esoui/art/icons/class/class_arcanist.dds",
};

export function classIcon(className: string): string | undefined {
  return CLASS_ICONS[className];
}

/**
 * Class hues from the game: fire, storm, shadow, sun, green, grave, and
 * Apocrypha. Kept distinct so two classes never share a color.
 */
export const CLASS_COLORS: Record<string, string> = {
  Dragonknight: "#e06a3a",
  Sorcerer: "#5b9fe8",
  Nightblade: "#b46ad4",
  Templar: "#e0c04a",
  Warden: "#3eaf62",
  Necromancer: "#8fbf7a",
  Arcanist: "#2fbfb0",
};

export function classColor(className: string): string | undefined {
  return CLASS_COLORS[className];
}

/** Live classes first, then any extra names a snapshot still carries. */
export function classFilterOrder(present: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [...ESO_CLASSES, ...present]) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
