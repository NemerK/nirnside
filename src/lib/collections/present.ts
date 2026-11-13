import type { House, OutfitStyleCategory, StickerbookSet } from "../snapshot/schema";
import type { StickerbookSetView } from "../stickerbook/seen";
import { presentOutfitStyles, type PresentedOutfitStyles } from "../knowledge/present";

/**
 * Account collections are three different game systems that Classic split into
 * peer sidebar modules. Atlas presents them as one Account → Collections hub:
 *
 * - stickerbook — set piece reconstruction (account-wide)
 * - styles — Collections → Outfit Styles (cosmetics, not craft motifs)
 * - houses — owned residences (never house banks)
 */

export type CollectionTab = "sets" | "styles" | "houses";

export interface CollectionsPresent {
  sets: {
    total: number;
    collected: number;
    setCount: number;
    pct: number;
    rows: StickerbookSetView[] | StickerbookSet[];
  };
  styles: PresentedOutfitStyles;
  houses: {
    total: number;
    primary: House | null;
    rows: House[];
  };
  /** Best default tab given what's populated. */
  defaultTab: CollectionTab;
}

export function presentCollections(input: {
  stickerbook: StickerbookSetView[] | StickerbookSet[];
  stickerStats?: { total: number; collected: number; sets: number };
  outfitStyles: OutfitStyleCategory[];
  houses: House[];
}): CollectionsPresent {
  const styles = presentOutfitStyles(input.outfitStyles);
  const houses = [...input.houses].sort((a, b) => {
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const primary = houses.find((h) => h.primary) ?? null;

  let total = input.stickerStats?.total ?? 0;
  let collected = input.stickerStats?.collected ?? 0;
  const setCount = input.stickerStats?.sets ?? input.stickerbook.length;
  if (!input.stickerStats) {
    for (const set of input.stickerbook) {
      for (const piece of set.pieces) {
        total += 1;
        if (piece.collected) collected += 1;
      }
    }
  }
  const pct = total > 0 ? Math.round((collected / total) * 100) : 0;

  let defaultTab: CollectionTab = "sets";
  if (total === 0 && styles.unlocked > 0) defaultTab = "styles";
  else if (total === 0 && styles.unlocked === 0 && houses.length > 0) defaultTab = "houses";

  return {
    sets: { total, collected, setCount, pct, rows: input.stickerbook },
    styles,
    houses: { total: houses.length, primary, rows: houses },
    defaultTab,
  };
}

export function collectionsSummaryLine(c: CollectionsPresent): string {
  const parts: string[] = [];
  if (c.sets.total > 0) parts.push(`${c.sets.pct}% stickerbook`);
  if (c.styles.total > 0) parts.push(`${c.styles.unlocked}/${c.styles.total} styles`);
  if (c.houses.total > 0) parts.push(`${c.houses.total} houses`);
  return parts.length > 0 ? parts.join(" · ") : "Nothing collected yet";
}
