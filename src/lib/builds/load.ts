import "server-only";
import { getSets } from "../db/catalog-queries";
import { listGearBuilds } from "../db/gear-builds";
import { getCharactersFull, getItems, getStickerbook } from "../db/queries";
import { liveCharacters } from "../snapshot/roster";
import { isMythicSet } from "../collections/mythic-match";
import type { Crafter, OwnedGear } from "./arrange";
import type { BuildPageData, BuildSetOption } from "./options";
import {
  isCraftedCategory,
  isDivinesTrait,
  kindFromPiece,
  kindsForCategory,
  setMatchKeys,
  setsShareKey,
  type SlotKind,
} from "./slots";

export type { BuildPageData, BuildSetOption };

function pieceKind(slot: string, type: string, name: string): SlotKind | null {
  return kindFromPiece(slot, type, name);
}

export function loadBuildPage(): BuildPageData {
  const sticker = getStickerbook();
  const catalog = getSets();
  const sets: BuildSetOption[] = [];

  for (const row of sticker) {
    const mythic = isMythicSet(row);
    const kinds: SlotKind[] = [];
    const collectedKinds: SlotKind[] = [];
    const icons: Partial<Record<SlotKind, string>> = {};
    for (const piece of row.pieces) {
      const kind = pieceKind(piece.slot, piece.type, piece.name);
      if (!kind) continue;
      if (!kinds.includes(kind)) kinds.push(kind);
      if (piece.collected && !collectedKinds.includes(kind)) collectedKinds.push(kind);
      if (piece.icon && (piece.collected || !icons[kind])) icons[kind] = piece.icon;
    }
    if (kinds.length === 0 && mythic) {
      const inferred = pieceKind("", "", row.name);
      if (inferred) kinds.push(inferred);
    }
    if (kinds.length === 0 && !mythic) {
      for (const kind of kindsForCategory(row.category, row.subcategory)) {
        if (!kinds.includes(kind)) kinds.push(kind);
      }
    }
    const match = catalog.find(
      (entry) =>
        ((entry.entry.setId ?? 0) > 0 && entry.entry.setId === row.setId) ||
        setsShareKey(setMatchKeys(entry.entry.name), setMatchKeys(row.name)),
    );
    const crafted = isCraftedCategory(row.category) || (match ? isCraftedCategory(match.entry.category) : false);
    sets.push({
      setId: row.setId,
      name: row.name,
      category: row.subcategory ? `${row.category} · ${row.subcategory}` : row.category,
      keys: setMatchKeys(row.name),
      kinds: mythic ? kinds.slice(0, 1) : kinds,
      collectedKinds: mythic ? collectedKinds.slice(0, 1) : collectedKinds,
      icons,
      collected: row.collected,
      total: row.total,
      crafted,
      traitsNeeded: crafted ? (match?.entry.traitsNeeded ?? null) : null,
      maxEquip: row.maxEquip ?? match?.entry.maxEquip ?? null,
      mythic,
    });
  }

  for (const entry of catalog) {
    const keys = setMatchKeys(entry.entry.name);
    if (sets.some((set) => ((entry.entry.setId ?? 0) > 0 && set.setId === entry.entry.setId) || setsShareKey(set.keys, keys))) {
      continue;
    }
    const mythic = isMythicSet(entry.entry);
    const crafted = isCraftedCategory(entry.entry.category);
    if (!crafted && !mythic) continue;
    const mythicKind = mythic ? pieceKind("", "", entry.entry.name) : null;
    sets.push({
      setId: entry.entry.setId ?? 0,
      name: entry.entry.name,
      category: entry.entry.category,
      keys,
      kinds: mythic ? (mythicKind ? [mythicKind] : []) : kindsForCategory(entry.entry.category, null),
      collectedKinds: [],
      icons: entry.entry.icon && mythicKind ? { [mythicKind]: entry.entry.icon } : {},
      collected: 0,
      total: 0,
      crafted,
      traitsNeeded: entry.entry.traitsNeeded,
      maxEquip: entry.entry.maxEquip,
      mythic,
    });
  }

  sets.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const owned: OwnedGear[] = [];
  const bagOnly = new Map<
    string,
    { name: string; setId: number; keys: string[]; kinds: SlotKind[]; icons: Partial<Record<SlotKind, string>>; weaponOnly: boolean }
  >();
  for (const item of getItems()) {
    if (!item.setName) continue;
    const kind = pieceKind(item.equipSlot ?? "", "", item.name);
    if (!kind) continue;
    const gear: OwnedGear = {
      keys: setMatchKeys(item.setName),
      setId: item.setId ?? null,
      itemName: item.name,
      kind,
      trait: item.trait,
      location: item.location,
      owner: item.ownerCharacter,
      icon: item.icon ?? null,
    };
    owned.push(gear);
    const set = sets.find(
      (option) => (gear.setId != null && gear.setId > 0 && option.setId === gear.setId) || setsShareKey(option.keys, gear.keys),
    );
    if (set) {
      if (!set.kinds.includes(kind)) set.kinds.push(kind);
      if (item.icon && !set.icons[kind]) set.icons[kind] = item.icon;
      continue;
    }
    const id = gear.keys[0] ?? item.setName;
    const bag = bagOnly.get(id) ?? {
      name: item.setName,
      setId: gear.setId ?? 0,
      keys: gear.keys,
      kinds: [],
      icons: {},
      weaponOnly: true,
    };
    if (!bag.kinds.includes(kind)) bag.kinds.push(kind);
    if (item.icon && !bag.icons[kind]) bag.icons[kind] = item.icon;
    if (kind !== "oneHand" && kind !== "twoHand" && kind !== "shield") bag.weaponOnly = false;
    bagOnly.set(id, bag);
  }
  for (const bag of bagOnly.values()) {
    const kinds = bag.weaponOnly ? bag.kinds : kindsForCategory("", null);
    sets.push({
      setId: bag.setId,
      name: bag.name,
      category: "In your bags",
      keys: bag.keys,
      kinds,
      collectedKinds: [],
      icons: bag.icons,
      collected: 0,
      total: 0,
      crafted: false,
      traitsNeeded: null,
      maxEquip: bag.weaponOnly ? 2 : 5,
      mythic: false,
    });
  }
  sets.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const crafters: Crafter[] = [];
  // getCharacters() is the light roster and blanks the research grid.
  for (const character of liveCharacters(getCharactersFull())) {
    const lines: Crafter["lines"] = [];
    for (const craft of character.research?.crafts ?? []) {
      for (const line of craft.lines) {
        lines.push({
          name: line.name,
          known: line.traits.filter((trait) => trait.known).length,
          divines: line.traits.some((trait) => trait.known && isDivinesTrait(trait.name)),
        });
      }
    }
    if (lines.length > 0) crafters.push({ name: character.name, lines });
  }

  return { sets, owned, crafters, builds: listGearBuilds() };
}
