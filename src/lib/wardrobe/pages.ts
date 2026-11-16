import type { WardrobePage, WardrobeZone } from "../snapshot/schema";

function hasSetup(page: WardrobePage): boolean {
  return page.setups.some((setup) => setup.name || setup.gear.length > 0 || setup.bars.length > 0);
}

/** Pages worth showing: a saved name, a page id, or at least one setup. */
export function visibleWardrobePages(zone: WardrobeZone): WardrobePage[] {
  const rows = zone.pages
    .map((page, index) => ({ page, index }))
    .filter(({ page }) => page.name.trim() !== "" || page.id != null || hasSetup(page));
  rows.sort((a, b) => {
    const left = a.page.id;
    const right = b.page.id;
    if (left != null && right != null && left !== right) return left - right;
    return a.index - b.index;
  });
  return rows.map((row) => row.page);
}

/**
 * Label for the page picker. A saved name is shown as Wizard's Wardrobe
 * stored it. "Page N" is only the addon's own default when no name was saved.
 */
export function wardrobePageTitle(page: Pick<WardrobePage, "name" | "id">, index: number): string {
  if (page.name.trim()) return page.name;
  if (page.id != null && page.id >= 1) return `Page ${page.id}`;
  return `Page ${index + 1}`;
}

export function wardrobePageKey(zoneTag: string, page: Pick<WardrobePage, "id" | "name">, index: number): string {
  return `${zoneTag}:${page.id ?? "n"}:${index}:${page.name}`;
}
