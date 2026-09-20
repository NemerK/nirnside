import type { Character } from "./schema";

export function isArchived(c: Character): boolean {
  return c.archivedAt != null && c.archivedAt > 0;
}

export function liveCharacters(chars: Character[]): Character[] {
  return chars.filter((c) => !isArchived(c));
}

export function archivedCharacters(chars: Character[]): Character[] {
  return chars.filter(isArchived);
}

/** Names of deleted characters whose last-known bags should stay out of the live inventory. */
export function archivedOwnerNames(chars: Character[]): Set<string> {
  return new Set(archivedCharacters(chars).map((c) => c.name));
}

export function archivedOwnerIds(chars: Character[]): Set<string> {
  return new Set(archivedCharacters(chars).map((c) => c.id));
}

export interface GoldBreakdown {
  /** Sum of live character wallets as of each toon's last snapshot. */
  wallets: number;
  bank: number;
  total: number;
  /** True when we had to use the old single account gold field (no per-toon wallets yet). */
  usedLegacy: boolean;
}

/**
 * Gold on the home screen must not be "whoever logged out last".
 * Live roster wallets + bank (Inventory Insight style), with a fallback to
 * older snapshots that only stored a single overwritten account gold field.
 * Deleted (archived) characters are excluded from the total.
 */
export function goldBreakdown(opts: {
  characters: Character[];
  bankGold?: number;
  legacyGold?: number;
}): GoldBreakdown {
  const wallets = liveCharacters(opts.characters).reduce((sum, c) => sum + (c.gold ?? 0), 0);
  const bank = opts.bankGold ?? 0;
  if (wallets > 0 || bank > 0) {
    return { wallets, bank, total: wallets + bank, usedLegacy: false };
  }
  const legacy = opts.legacyGold ?? 0;
  return { wallets: 0, bank: 0, total: legacy, usedLegacy: legacy > 0 };
}

export function accountGold(opts: {
  characters: Character[];
  bankGold?: number;
  legacyGold?: number;
}): number {
  return goldBreakdown(opts).total;
}
