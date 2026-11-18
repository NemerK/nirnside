/** A gear build the player saved. Not part of the ESO snapshot. */
export interface SavedBuild {
  id: string;
  name: string;
  createdAt: number;
  bodySetId: number | null;
  bodyName: string | null;
  monsterSetId: number | null;
  monsterName: string | null;
  monsterPieces: 1 | 2;
  mythicSetId: number | null;
  mythicName: string | null;
  frontSetId: number | null;
  frontName: string | null;
  backSetId: number | null;
  backName: string | null;
}

export function emptyBuild(): Omit<SavedBuild, "id" | "name" | "createdAt"> {
  return {
    bodySetId: null,
    bodyName: null,
    monsterSetId: null,
    monsterName: null,
    monsterPieces: 2,
    mythicSetId: null,
    mythicName: null,
    frontSetId: null,
    frontName: null,
    backSetId: null,
    backName: null,
  };
}
