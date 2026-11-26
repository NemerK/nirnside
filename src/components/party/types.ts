/** A destination the Party navigation and search can open. */
export interface PartyLink {
  id: string;
  label: string;
  href: string;
  blurb: string;
}

/** The slice of a character the party band and search need. */
export interface PartyMember {
  id: string;
  name: string;
  className: string;
  race: string;
  level: number;
  championPoints: number;
  /** Null until this character has logged out with the addon installed. */
  lastSeen: number | null;
  vampireStage: number;
  werewolf: boolean;
  /** In-game class crest texture path, when known. */
  crest: string | null;
}

export interface PartyAccount {
  displayName: string;
  region: string;
  esoPlus: boolean;
  lastSnapshot: number;
}
