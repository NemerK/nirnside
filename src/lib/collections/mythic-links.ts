import { findMythic, type MythicIdentity } from "../game/mythics";

/** Where Nirnside links a mythic: its leads on the collection page. */
export function mythicAnchor(setId: number): string {
  return `mythic-${setId}`;
}

/** Where a mythic click shows the leads that are still missing. */
export function mythicPageHref(setId: number): string {
  return `/stickerbook#${mythicAnchor(setId)}`;
}

export function hrefForMythicOrSet(
  mythics: readonly MythicIdentity[],
  opts: { setId?: number | null; name?: string | null },
  encyclopediaHref: string,
): string {
  const mythic = findMythic(mythics, opts);
  return mythic ? mythicPageHref(mythic.setId) : encyclopediaHref;
}
