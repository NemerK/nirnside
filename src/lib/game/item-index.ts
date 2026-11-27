import type { AccountSnapshot } from "../snapshot/schema";
import { parsePieceType, parseWornSlot, pieceKey, pieceKindFromName, type PieceKind } from "./equipment";
import { itemPlace, type PlaceSource } from "./item-category";

/**
 * Every item the account holds, plus every piece of the set collection,
 * keyed by the game's item id, with where each one belongs.
 *
 * - Sources in a scan: bags and banks, worn gear, and the set collection
 *   (the collection lists every piece of every set, collected or not, so
 *   those pieces describe the game, not this account's bags).
 * - Each import brings the index in line with the scan: an item no longer
 *   on the account (sold, deconstructed, destroyed, or on a deleted
 *   character) leaves it, unless the set collection still lists it.
 * - Only facts the game reported are kept. A field the scan didn't carry
 *   stays empty rather than being guessed; a name is read only through the
 *   model's own parser of the game's piece words (pieceKindFromName).
 * - Each item is filed by `itemPlace`: the game's own inventory tab first,
 *   then its piece kind.
 */
export interface LearnedItem {
  itemId: number;
  name: string;
  icon: string | null;
  /** pieceKey(): "heavy-head", "ring", "greatsword". Null for non-gear. */
  kind: string | null;
  setId: number | null;
  setName: string | null;
  /** Where the latest scan has it: "bag", "worn", "collection". */
  seenIn: string[];
  /** Its place: a BAG_CATEGORIES id and sub id. */
  category: string | null;
  subtype: string | null;
  /** The game's item type label ("Food") and finer kind, when read. */
  typeLabel: string | null;
  specializedLabel: string | null;
  /** Who filed it: the game's own tab, or the piece kind. */
  placeFrom: PlaceSource | null;
}

type Fact = {
  name?: string | null;
  icon?: string | null;
  kind?: PieceKind | null;
  setId?: number | null;
  setName?: string | null;
  bagCategory?: string | null;
  bagSubtype?: string | null;
  itemTypeLabel?: string | null;
  specializedTypeLabel?: string | null;
};

/** Everything a snapshot says about items, merged per item id. */
export function itemsFromSnapshot(snap: AccountSnapshot): LearnedItem[] {
  const out = new Map<number, LearnedItem>();
  const add = (itemId: number | null | undefined, seen: string, fact: Fact) => {
    if (!itemId || itemId <= 0) return;
    const prev = out.get(itemId);
    const next: LearnedItem = prev ?? {
      itemId,
      name: "",
      icon: null,
      kind: null,
      setId: null,
      setName: null,
      seenIn: [],
      category: null,
      subtype: null,
      typeLabel: null,
      specializedLabel: null,
      placeFrom: null,
    };
    if (fact.name && !next.name) next.name = fact.name;
    if (fact.icon && !next.icon) next.icon = fact.icon;
    if (fact.kind && !next.kind) next.kind = pieceKey(fact.kind);
    if (fact.setId != null && next.setId == null) next.setId = fact.setId;
    if (fact.setName && !next.setName) next.setName = fact.setName;
    const place = itemPlace(fact, fact.kind ?? null);
    // The game's own filing beats the piece kind's.
    if (place && (next.placeFrom == null || (next.placeFrom === "piece" && place.from === "game"))) {
      next.category = place.category;
      next.subtype = place.subtype;
      next.placeFrom = place.from;
    }
    next.typeLabel ??= place?.typeLabel ?? null;
    next.specializedLabel ??= place?.specializedLabel ?? null;
    if (!next.seenIn.includes(seen)) next.seenIn.push(seen);
    out.set(itemId, next);
  };

  for (const it of snap.items) {
    // The game's piece type when the save has it, else the game's own piece words in the name.
    add(it.itemId, "bag", { ...it, kind: parsePieceType(it.equipSlot) ?? pieceKindFromName(it.name) });
  }
  // Deleted characters' gear is gone from the account.
  for (const c of snap.characters) {
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

/**
 * The scan's item over what was known: facts the game already gave stay,
 * gaps fill in, and where it is now is the scan's.
 */
export function mergeLearned(known: LearnedItem | undefined, seen: LearnedItem): LearnedItem {
  if (!known) return seen;
  const placeFromScan = seen.placeFrom === "game" || known.placeFrom == null;
  return {
    itemId: known.itemId,
    name: seen.name || known.name,
    icon: seen.icon ?? known.icon,
    kind: known.kind ?? seen.kind,
    setId: known.setId ?? seen.setId,
    setName: seen.setName ?? known.setName,
    seenIn: seen.seenIn,
    category: placeFromScan ? seen.category ?? known.category : known.category,
    subtype: placeFromScan ? seen.subtype ?? known.subtype : known.subtype,
    placeFrom: placeFromScan ? seen.placeFrom ?? known.placeFrom : known.placeFrom,
    typeLabel: seen.typeLabel ?? known.typeLabel,
    specializedLabel: seen.specializedLabel ?? known.specializedLabel,
  };
}

/** Item ids the index should drop: known before, absent from this scan. */
export function goneItems(knownIds: Iterable<number>, scan: readonly LearnedItem[]): number[] {
  const now = new Set(scan.map((i) => i.itemId));
  return [...knownIds].filter((id) => !now.has(id));
}
