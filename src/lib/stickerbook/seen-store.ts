import { getMeta, setMeta } from "../db";
import { mergeSeenIds, shouldReseedSeen, type StickerbookSeenState } from "./seen";

const META_KEY = "stickerbookSeen";

function readState(): StickerbookSeenState | null {
  try {
    return getMeta<StickerbookSeenState>(META_KEY);
  } catch {
    return null;
  }
}

function writeState(state: StickerbookSeenState): void {
  setMeta(META_KEY, state);
}

/** First visit / new account: treat everything already collected as seen. */
export function seedStickerbookSeenIfNeeded(account: string, collectedKeys: string[]): StickerbookSeenState {
  const prev = readState();
  if (!shouldReseedSeen(prev, account)) return prev as StickerbookSeenState;
  const next: StickerbookSeenState = { account, seeded: true, ids: [...new Set(collectedKeys)] };
  writeState(next);
  return next;
}

export function markStickerbookPiecesSeen(account: string, keys: string[]): string[] {
  const prev = readState();
  const ids = mergeSeenIds(prev && prev.account === account ? prev.ids : [], keys);
  writeState({ account, seeded: true, ids });
  return ids;
}

/** Seen ids for this account, seeding the current collection on first use. */
export function stickerbookSeenIds(account: string, collectedKeys: string[]): Set<string> {
  return new Set(seedStickerbookSeenIfNeeded(account, collectedKeys).ids);
}
