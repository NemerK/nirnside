import type { Crafter, OwnedGear } from "./arrange";
import type { SavedBuild } from "./saved";
import type { SlotKind } from "./slots";

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
  collected: number;
  total: number;
  crafted: boolean;
  traitsNeeded: number | null;
  maxEquip: number | null;
  mythic: boolean;
}

export interface BuildPageData {
  sets: BuildSetOption[];
  owned: OwnedGear[];
  crafters: Crafter[];
  builds: SavedBuild[];
}
