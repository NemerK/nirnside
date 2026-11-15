export type MythicIdentity = {
  setId: number;
  name: string;
};

/** "Ring of the Pale Order" and the stickerbook's "Pale Order" are the same mythic. */
export function mythicNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/^ring of the /, "").replace(/^the /, "");
}

export function findMythic<T extends MythicIdentity>(
  mythics: readonly T[],
  opts: { setId?: number | null; name?: string | null },
): T | undefined {
  if (opts.setId != null && opts.setId !== 0) {
    const byId = mythics.find((mythic) => mythic.setId === opts.setId);
    if (byId) return byId;
  }
  const key = opts.name ? mythicNameKey(opts.name) : "";
  if (!key) return undefined;
  return mythics.find((mythic) => mythicNameKey(mythic.name) === key);
}

export function isMythicCategory(category: string | null | undefined): boolean {
  return (category ?? "").toLowerCase().includes("mythic");
}

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
