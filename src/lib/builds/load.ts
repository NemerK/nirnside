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
  isMonsterSet,
  kindFromPiece,
  kindsForCategory,
  characterHolding,
  resolveOwnedPiece,
  setMatchKeys,
  setsShareKey,
  weaponTypeFromPiece,
  type FrontWeapon,
  type SlotKind,
} from "./slots";
import { isBodyArmor, weightFromPieceName, weightFromText, weightsForSet, type ArmorWeight } from "./traits";

export type { BuildPageData, BuildSetOption };

function pieceKind(slot: string, type: string, name: string): SlotKind | null {
  return kindFromPiece(slot, type, name);
}

function armorWeightOf(kind: SlotKind | null, weight: string | null, type: string, name: string): ArmorWeight | null {
  if (!kind || !isBodyArmor(kind)) return null;
  return weightFromText(weight) ?? weightFromText(type) ?? weightFromPieceName(name);
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
    const collectedWeapons = new Set<FrontWeapon>();
    const weaponIcons: Partial<Record<FrontWeapon, string>> = {};
    const seenWeights: ArmorWeight[] = [];
    for (const piece of row.pieces) {
      const kind = pieceKind(piece.slot, piece.type, piece.name);
      const weight = armorWeightOf(kind, piece.weight, piece.type, piece.name);
      if (weight) seenWeights.push(weight);
      const weapon = weaponTypeFromPiece(piece.slot, piece.type, piece.name);
      if (weapon) {
        if (piece.collected) collectedWeapons.add(weapon);
        if (piece.icon && (piece.collected || !weaponIcons[weapon])) weaponIcons[weapon] = piece.icon;
      }
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
      collectedWeapons: [...collectedWeapons],
      weaponIcons,
      collected: row.collected,
      total: row.total,
      crafted,
      traitsNeeded: crafted ? (match?.entry.traitsNeeded ?? null) : null,
      maxEquip: row.maxEquip ?? match?.entry.maxEquip ?? null,
      mythic,
      armorWeights: weightsForSet({
        crafted,
        mythic,
        monster: isMonsterSet({ mythic, category: row.category, kinds }),
        category: row.category,
        seen: seenWeights,
      }),
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
    const catalogKinds = mythic ? (mythicKind ? [mythicKind] : []) : kindsForCategory(entry.entry.category, null);
    const mythicWeight = mythic ? armorWeightOf(mythicKind, null, "", entry.entry.name) : null;
    sets.push({
      setId: entry.entry.setId ?? 0,
      name: entry.entry.name,
      category: entry.entry.category,
      keys,
      kinds: catalogKinds,
      collectedKinds: [],
      icons: entry.entry.icon && mythicKind ? { [mythicKind]: entry.entry.icon } : {},
      collectedWeapons: [],
      weaponIcons: {},
      collected: 0,
      total: 0,
      crafted,
      traitsNeeded: entry.entry.traitsNeeded,
      maxEquip: entry.entry.maxEquip,
      mythic,
      armorWeights: weightsForSet({
        crafted,
        mythic,
        monster: isMonsterSet({ mythic, category: entry.entry.category, kinds: catalogKinds }),
        category: entry.entry.category,
        seen: mythicWeight ? [mythicWeight] : [],
      }),
    });
  }

  sets.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const book = sticker.flatMap((row) =>
    row.pieces.map((piece) => ({
      setId: row.setId,
      keys: setMatchKeys(row.name),
      name: piece.name,
      slot: piece.slot,
      type: piece.type,
      itemId: piece.itemId ?? null,
    })),
  );

  const owned: OwnedGear[] = [];
  const bagOnly = new Map<
    string,
    {
      name: string;
      setId: number;
      keys: string[];
      kinds: SlotKind[];
      icons: Partial<Record<SlotKind, string>>;
      weaponIcons: Partial<Record<FrontWeapon, string>>;
      weaponOnly: boolean;
      weights: ArmorWeight[];
    }
  >();
  for (const item of getItems()) {
    if (!item.setName) continue;
    const keys = setMatchKeys(item.setName);
    const pieces = book.filter(
      (piece) => (item.setId != null && item.setId > 0 && piece.setId === item.setId) || setsShareKey(piece.keys, keys),
    );
    const resolved = resolveOwnedPiece({ name: item.name, itemId: item.itemId, equipSlot: item.equipSlot }, pieces);
    if (!resolved) continue;
    const kind = resolved.kind;
    const linked = pieces.find(
      (piece) =>
        ((item.itemId ?? 0) > 0 && piece.itemId === item.itemId) ||
        (item.name.trim() !== "" && piece.name.trim().toLowerCase() === item.name.trim().toLowerCase()),
    );
    const weight = isBodyArmor(kind)
      ? (weightFromText(item.equipSlot) ??
        weightFromPieceName(item.name) ??
        (linked ? (weightFromText(linked.type) ?? weightFromPieceName(linked.name)) : null))
      : null;
    const gear: OwnedGear = {
      keys,
      setId: item.setId ?? null,
      itemName: item.name,
      kind,
      trait: item.trait,
      location: item.location,
      owner: characterHolding(item.ownerCharacter, item.location),
      icon: item.icon ?? null,
      weapon: resolved.weapon,
      weight,
    };
    owned.push(gear);
    const set = sets.find(
      (option) => (gear.setId != null && gear.setId > 0 && option.setId === gear.setId) || setsShareKey(option.keys, gear.keys),
    );
    if (set) {
      if (!set.kinds.includes(kind)) set.kinds.push(kind);
      if (item.icon && !set.icons[kind]) set.icons[kind] = item.icon;
      if (gear.weapon && item.icon && !set.weaponIcons[gear.weapon]) set.weaponIcons[gear.weapon] = item.icon;
      continue;
    }
    const id = gear.keys[0] ?? item.setName;
    const bag = bagOnly.get(id) ?? {
      name: item.setName,
      setId: gear.setId ?? 0,
      keys: gear.keys,
      kinds: [],
      icons: {},
      weaponIcons: {},
      weaponOnly: true,
      weights: [],
    };
    if (weight) bag.weights.push(weight);
    if (!bag.kinds.includes(kind)) bag.kinds.push(kind);
    if (item.icon && !bag.icons[kind]) bag.icons[kind] = item.icon;
    if (gear.weapon && item.icon && !bag.weaponIcons[gear.weapon]) bag.weaponIcons[gear.weapon] = item.icon;
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
      collectedWeapons: [],
      weaponIcons: bag.weaponIcons,
      collected: 0,
      total: 0,
      crafted: false,
      traitsNeeded: null,
      maxEquip: bag.weaponOnly ? 2 : 5,
      mythic: false,
      armorWeights: weightsForSet({
        crafted: false,
        mythic: false,
        monster: isMonsterSet({ mythic: false, category: "", kinds }),
        category: "",
        seen: bag.weights,
      }),
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
          traits: line.traits.filter((trait) => trait.known).map((trait) => trait.name),
        });
      }
    }
    if (lines.length > 0) crafters.push({ name: character.name, lines });
  }

  return { sets, owned, crafters, builds: listGearBuilds() };
}
