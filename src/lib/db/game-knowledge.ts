import "server-only";
import { classLineMap } from "../game/classes";
import { getSkillLines } from "./catalog-queries";

/** Class → its skill lines, from the game catalog (the in-game scan wins over shipped reference data). */
export function classLines(): Map<string, string[]> {
  try {
    return classLineMap(getSkillLines().map(({ entry }) => ({ name: entry.name, className: entry.className })));
  } catch {
    return new Map();
  }
}
