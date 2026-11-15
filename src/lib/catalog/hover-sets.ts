import "server-only";
import { listSetBriefs } from "@/lib/db/catalog-queries";
import { listAccountSets } from "@/lib/db/queries";
import {
  briefsForHover,
  indexKnownSets,
  type KnownSet,
  type KnownSetIndex,
  type SetBrief,
} from "./set-brief";

/** Catalog cards plus every stickerbook set, and the name index used to associate gear. */
export function loadSetHover(): { known: KnownSetIndex; knownList: KnownSet[]; briefs: SetBrief[] } {
  let account: ReturnType<typeof listAccountSets> = [];
  let catalog: SetBrief[] = [];
  try {
    account = listAccountSets();
  } catch {
    account = [];
  }
  try {
    catalog = listSetBriefs();
  } catch {
    catalog = [];
  }
  const knownList: KnownSet[] = [
    ...account.map((set) => ({ name: set.name, setId: set.setId })),
    ...catalog.map((set) => ({ name: set.name, setId: set.setId })),
  ];
  return { known: indexKnownSets(knownList), knownList, briefs: briefsForHover(catalog, account) };
}
