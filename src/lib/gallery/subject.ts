import { getCharacters, getHouses } from "../db/queries";
import { parseGalleryOwner, type GalleryKind } from "./rules";

export type GallerySubject = {
  kind: GalleryKind;
  id: string;
  title: string;
  detail: string;
  backHref: string;
  backLabel: string;
};

/** A live roster character. Archived characters are not a gallery. */
export function characterGallerySubject(id: string): GallerySubject | null {
  const owner = parseGalleryOwner("character", id);
  if (!owner) return null;
  const character = getCharacters().find((row) => row.id === owner.id);
  if (!character) return null;
  return {
    kind: "character",
    id: character.id,
    title: character.name,
    detail: `${character.race} ${character.class}`,
    backHref: "/characters",
    backLabel: "Roster",
  };
}

/** An unlocked house collectible on this account. */
export function houseGallerySubject(id: string): GallerySubject | null {
  const owner = parseGalleryOwner("house", id);
  if (!owner) return null;
  const house = getHouses().find((row) => String(row.collectibleId) === owner.id);
  if (!house) return null;
  return {
    kind: "house",
    id: owner.id,
    title: house.name,
    detail: house.location?.trim() || "Owned house",
    backHref: "/houses",
    backLabel: "Houses",
  };
}

export function gallerySubject(kind: string, id: string): GallerySubject | null {
  if (kind === "character") return characterGallerySubject(id);
  if (kind === "house") return houseGallerySubject(id);
  return null;
}
