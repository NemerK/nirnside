import type { Crafter, OwnedGear } from "./arrange";
import type { SavedBuild } from "./saved";
import type { FrontWeapon, SlotKind } from "./slots";
import type { ArmorWeight } from "./traits";

/** One set the picker can offer. Built on the server from the stickerbook and catalog. */
export interface BuildSetOption {
  setId: number;
  name: string;
  category: string;
  keys: string[];
  kinds: SlotKind[];
  collectedKinds: SlotKind[];
  /** In-game icon path per slot, from the stickerbook piece or an owned item. */
  icons: Partial<Record<SlotKind, string>>;
  /** Weapon types with a collected stickerbook piece. */
  collectedWeapons: FrontWeapon[];
  weaponIcons: Partial<Record<FrontWeapon, string>>;
  collected: number;
  total: number;
  crafted: boolean;
  traitsNeeded: number | null;
  maxEquip: number | null;
  mythic: boolean;
  /** Body weights this set can be made in. Empty when no armor weight was scanned. */
  armorWeights: ArmorWeight[];
  /** Crystals the game charges to reconstruct a piece of this set (snapshot 0.9.47+); null until saved. */
  reconstructCost?: number | null;
}

export interface BuildPageData {
  sets: BuildSetOption[];
  owned: OwnedGear[];
  crafters: Crafter[];
  /** Crystals for a trait change: the game's (rules), the reference until a save carries it. */
  retraitCost: number;
  builds: SavedBuild[];
}
