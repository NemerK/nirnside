import { getAccount, getCharactersFull, getHouses, getOutfitStyles, getStickerbook, getStickerbookStats } from "@/lib/db/queries";
import { presentCollections } from "@/lib/collections/present";
import { knownMotifKeys } from "@/lib/knowledge/present";
import { liveCharacters } from "@/lib/snapshot/roster";
import { AtlasCollectionsHub } from "@/components/atlas/collections-hub";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const stickerbook = safe(() => getStickerbook()) ?? [];
  const stickerStats = safe(() => getStickerbookStats()) ?? { total: 0, collected: 0, sets: 0 };
  const outfitStyles = safe(() => getOutfitStyles()) ?? [];
  const houses = safe(() => getHouses()) ?? [];
  const motifKeys = [
    ...new Set(
      liveCharacters(safe(() => getCharactersFull()) ?? []).flatMap((character) => [...knownMotifKeys(character.motifs)]),
    ),
  ];
  const collections = presentCollections({
    stickerbook,
    stickerStats,
    outfitStyles,
    houses,
  });

  return (
    <AtlasCollectionsHub
          collections={collections}
          motifKeys={motifKeys}
          mythics={safe(() => getAccount()?.mythics ?? []) ?? []}
        />
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
