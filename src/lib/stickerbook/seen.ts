import type { StickerbookPiece, StickerbookSet } from "../snapshot/schema";

export type StickerbookSeenState = {
  account: string;
  seeded: true;
  ids: string[];
};

export type StickerbookPieceView = StickerbookPiece & {
  pieceKey: string;
  isNew: boolean;
};

export type StickerbookSetView = Omit<StickerbookSet, "pieces"> & {
  total: number;
  collected: number;
  newCount: number;
  pieces: StickerbookPieceView[];
};

/** Stable id for one collection slot. The snapshot does not store a pieceId. */
export function stickerPieceKey(
  setId: number,
  piece: Pick<StickerbookPiece, "slot" | "name" | "type">,
): string {
  return `${setId}\t${piece.slot ?? ""}\t${piece.name ?? ""}\t${piece.type ?? ""}`;
}

export function collectedPieceKeys(
  sets: Array<{ setId: number; pieces: Array<Pick<StickerbookPiece, "slot" | "name" | "type" | "collected">> }>,
): string[] {
  const keys: string[] = [];
  for (const s of sets) {
    for (const p of s.pieces) {
      if (p.collected) keys.push(stickerPieceKey(s.setId, p));
    }
  }
  return keys;
}

export function shouldReseedSeen(state: StickerbookSeenState | null | undefined, account: string): boolean {
  return !state?.seeded || state.account !== account;
}

export function mergeSeenIds(prev: Iterable<string>, add: Iterable<string>): string[] {
  return [...new Set([...prev, ...add])];
}

export function annotateStickerbookSets(
  sets: Array<StickerbookSet & { total: number; collected: number }>,
  seen: ReadonlySet<string>,
): StickerbookSetView[] {
  return sets.map((s) => {
    const pieces: StickerbookPieceView[] = s.pieces.map((p) => {
      const pieceKey = stickerPieceKey(s.setId, p);
      return {
        ...p,
        pieceKey,
        isNew: p.collected === true && !seen.has(pieceKey),
      };
    });
    return {
      ...s,
      pieces,
      newCount: pieces.filter((p) => p.isNew).length,
    };
  });
}
