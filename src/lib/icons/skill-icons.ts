import raw from "../../../data/icons/skill-icons.json";

/**
 * Community skill-name → icon-file map (base + morphs), bundled so it works
 * offline. It exists only to *fill an icon we do not otherwise have*: an
 * in-game snapshot icon always wins. Icon art is fetched from mirrors by the
 * `/api/icon` proxy. Source is credited in the JSON `_source` field.
 */
const NAME_TO_STEM: Record<string, string> = (raw as { map?: Record<string, string> }).map ?? {};

function key(name: string): string {
  return name.trim().toLowerCase();
}

/** A game texture path we can hand to GameIcon / the icon proxy. */
function pathFor(stem: string): string {
  return `esoui/art/icons/${stem}.dds`;
}

/** Direct icon for an exact skill or morph name, if the map knows it. */
export function skillIconByName(name: string): string | null {
  const stem = NAME_TO_STEM[key(name)];
  return stem ? pathFor(stem) : null;
}

/**
 * A base ability is usually the morph stem without its `_a`/`_b` suffix
 * (Onslaught `ability_2handed_006_a` → base `ability_2handed_006`). When the
 * base name itself is unknown, derive it from any morph name we do know.
 */
export function baseIconFromMorphNames(morphNames: (string | null | undefined)[]): string | null {
  for (const name of morphNames) {
    if (!name) continue;
    const stem = NAME_TO_STEM[key(name)];
    if (!stem) continue;
    const base = stem.replace(/_[ab]$/, "");
    if (base !== stem) return pathFor(base);
  }
  return null;
}

/**
 * Best icon path for an ability given its own name and its morph slot names,
 * or null when the map has nothing. Never overrides a real snapshot icon —
 * callers pass this only as a fallback.
 */
export function resolveSkillIcon(name: string, morphNames: (string | null | undefined)[] = []): string | null {
  return skillIconByName(name) ?? baseIconFromMorphNames(morphNames) ?? baseIconFromMorphNames([name]);
}
