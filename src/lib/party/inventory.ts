import type { Item } from "../snapshot/schema";
import { esoPlainText } from "../text/eso-markup";

/**
 * An item's numbers in one line, as its tooltip gives them (snapshot
 * 0.9.46+): damage or armor, the enchant, and what using it does. Null when
 * the save holds none.
 */
export function itemValuesLine(item: Item): string | null {
  const parts = [
    // The tooltip's own labels (SI_ITEM_FORMAT_STR_DAMAGE, SI_ITEM_FORMAT_STR_ARMOR).
    item.weaponPower ? `Damage ${item.weaponPower.toLocaleString("en-US")}` : item.armor ? `Armor ${item.armor.toLocaleString("en-US")}` : null,
    item.enchant ? esoPlainText(item.enchant) : null,
    ...(item.use ?? []).map((u) => esoPlainText(u)),
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** Where some of an item is: a character's bags, or an account-wide bag. */
export interface Holder {
  /** Character name for backpack/worn, null for bank, subscriber bank, craft bag… */
  owner: string | null;
  location: string;
  count: number;
}

/** One kind of item, however many stacks and characters it is spread over. */
export interface ItemGroup {
  key: string;
  /** The first stack, for name, quality, set, trait, bag category… */
  item: Item;
  total: number;
  stacks: number;
  holders: Holder[];
}

function groupKey(it: Item): string {
  return [it.name, it.quality ?? "", it.setName ?? "", it.trait ?? "", it.level ?? "", it.stolen ? "s" : ""].join("|");
}

/**
 * The same item in twenty backpacks is one row: "Alliance War Repair Kit, 240,
 * held by …". Holders are merged per character and bag, biggest first.
 * Groups keep the order of their first stack.
 */
export function groupItems(items: Item[]): ItemGroup[] {
  const groups = new Map<string, ItemGroup>();
  const holderIndex = new Map<string, Map<string, Holder>>();
  for (const it of items) {
    const key = groupKey(it);
    let g = groups.get(key);
    if (!g) {
      g = { key, item: it, total: 0, stacks: 0, holders: [] };
      groups.set(key, g);
      holderIndex.set(key, new Map());
    }
    g.total += it.count;
    g.stacks += 1;
    const owner = it.location === "backpack" || it.location === "worn" ? (it.ownerCharacter ?? null) : null;
    const hk = `${owner ?? ""}|${it.location}`;
    const index = holderIndex.get(key)!;
    const h = index.get(hk);
    if (h) h.count += it.count;
    else {
      const fresh = { owner, location: it.location, count: it.count };
      index.set(hk, fresh);
      g.holders.push(fresh);
    }
  }
  for (const g of groups.values()) g.holders.sort((a, b) => b.count - a.count);
  return [...groups.values()];
}
