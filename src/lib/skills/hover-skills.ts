import "server-only";
import { catalogAbilityLoreFor } from "@/lib/db/catalog-queries";
import { briefsFromLore, type SkillBrief } from "./skill-brief";

/** Catalog tooltips for the skill names a page is about to show. */
export function skillBriefsForNames(names: Iterable<string>): SkillBrief[] {
  try {
    const list = [...names];
    return briefsFromLore(list, catalogAbilityLoreFor(list));
  } catch {
    return [];
  }
}
