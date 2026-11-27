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

/**
 * The live stickerbook files mythics under Miscellaneous, with Mythics as the
 * subcategory. Older snapshots used a top-level Mythic Items category.
 */
export function isMythicSet(set: { category?: string | null; subcategory?: string | null }): boolean {
  return isMythicCategory(set.category) || isMythicCategory(set.subcategory);
}
