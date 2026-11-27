import type { AccountSnapshot } from "../snapshot/schema";
import { parsePieceType, parseWornSlot, pieceKey, pieceKindFromName, type PieceKind } from "./equipment";

/**
 * What Nirnside has learned about the game's items, keyed by the game's item
 * id. Every scan adds what it saw (bags, banks, worn gear, the set
 * collection), and nothing is forgotten when a newer scan no longer holds an
 * item: the index only grows, so it ends up knowing the items of the game
 * that this account has ever touched.
 *
 * Only facts the game reported are kept. A field the scan didn't carry
 * stays as it was rather than being guessed.
 */
export interface LearnedItem {
  itemId: number;
  name: string;
  icon: string | null;
  /** pieceKey(): "heavy-head", "ring", "greatsword". Null for non-gear. */
  kind: string | null;
  setId: number | null;
  setName: string | null;
  /** Where it has been seen: "bag", "worn", "collection". */
  seenIn: string[];
}

/** Everything a snapshot says about items, merged per item id. */
export function itemsFromSnapshot(snap: AccountSnapshot): LearnedItem[] {
  const out = new Map<number, LearnedItem>();
  const add = (
    itemId: number | null | undefined,
    seen: string,
    fact: { name?: string | null; icon?: string | null; kind?: PieceKind | null; setId?: number | null; setName?: string | null },
  ) => {
    if (!itemId || itemId <= 0) return;
    const prev = out.get(itemId);
    const next: LearnedItem = prev ?? { itemId, name: "", icon: null, kind: null, setId: null, setName: null, seenIn: [] };
    if (fact.name && !next.name) next.name = fact.name;
    if (fact.icon && !next.icon) next.icon = fact.icon;
    if (fact.kind && !next.kind) next.kind = pieceKey(fact.kind);
    if (fact.setId != null && next.setId == null) next.setId = fact.setId;
    if (fact.setName && !next.setName) next.setName = fact.setName;
    if (!next.seenIn.includes(seen)) next.seenIn.push(seen);
    out.set(itemId, next);
  };

  for (const it of snap.items) {
    add(it.itemId, "bag", {
      name: it.name,
      icon: it.icon,
      kind: parsePieceType(it.equipSlot) ?? null,
      setId: it.setId,
      setName: it.setName,
    });
  }
  for (const c of [...snap.characters, ...snap.archivedCharacters]) {
    for (const e of c.equipped) {
      const worn = parseWornSlot(e.slot);
      // A worn slot names the piece only for armor and jewelry; weapons come from the name.
      const kind =
        parsePieceType(e.type) ??
        (worn === "necklace"
          ? parsePieceType("Necklace")
          : worn === "ring1" || worn === "ring2"
            ? parsePieceType("Ring")
            : pieceKindFromName(e.name));
      add(e.itemId, "worn", { name: e.name, icon: e.icon, kind, setId: e.setId ?? null, setName: e.setName ?? null });
    }
  }
  for (const s of snap.stickerbook) {
    for (const p of s.pieces) {
      add(p.itemId, "collection", {
        name: p.name,
        icon: p.icon,
        kind: parsePieceType(p.type, p.weight),
        setId: s.setId,
        setName: s.name,
      });
    }
  }
  return [...out.values()];
}

/** Merge a newly seen item into what was known: known facts win, gaps fill in, sightings add up. */
export function mergeLearned(known: LearnedItem | undefined, seen: LearnedItem): LearnedItem {
  if (!known) return seen;
  return {
    itemId: known.itemId,
    name: seen.name || known.name,
    icon: seen.icon ?? known.icon,
    kind: known.kind ?? seen.kind,
    setId: known.setId ?? seen.setId,
    setName: seen.setName ?? known.setName,
    seenIn: [...new Set([...known.seenIn, ...seen.seenIn])],
  };
}

