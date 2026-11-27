import type { AccountSnapshot, Character } from "./schema";

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

/**
 * The snapshot without deleted characters. The addon notices a deletion when
 * the game's own character list no longer has the character (it then files
 * it under archivedCharacters), and a deleted character's bags left with it.
 * Older addons kept those bags in the save, so they are dropped here too.
 */
export function withoutDeletedCharacters(snap: AccountSnapshot): { snap: AccountSnapshot; deleted: Character[] } {
  const deleted = [...snap.archivedCharacters, ...archivedCharacters(snap.characters)];
  if (deleted.length === 0) return { snap, deleted };
  const live = liveCharacters(snap.characters);
  const goneIds = new Set(deleted.map((c) => c.id));
  const liveNames = new Set(live.map((c) => c.name));
  const goneNames = new Set(deleted.map((c) => c.name).filter((n) => !liveNames.has(n)));
  const items = snap.items.filter((it) => {
    if (it.ownerCharacterId) return !goneIds.has(it.ownerCharacterId);
    return !(it.ownerCharacter && goneNames.has(it.ownerCharacter));
  });
  return { snap: { ...snap, characters: live, archivedCharacters: [], items }, deleted };
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

/** Live roster Tel Var. Same last-logout trap as gold if stored only on the account. */
export function accountTelVar(opts: { characters: Character[]; legacyTelVar?: number }): number {
  const fromChars = liveCharacters(opts.characters).reduce((sum, c) => sum + (c.telVar ?? 0), 0);
  if (fromChars > 0) return fromChars;
  return opts.legacyTelVar ?? 0;
}

/**
 * Alliance Points are character-bound. Sum live toons so Home is not whoever
 * logged out last. Fall back to an older account-wide field when no per-toon
 * AP has been scanned yet.
 */
export function accountAlliancePoints(opts: {
  characters: Character[];
  legacyAlliancePoints?: number;
}): number {
  const fromChars = liveCharacters(opts.characters).reduce((sum, c) => sum + (c.alliancePoints ?? 0), 0);
  if (fromChars > 0) return fromChars;
  return opts.legacyAlliancePoints ?? 0;
}
