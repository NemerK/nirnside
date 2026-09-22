/** Player-authored skill-line rank targets. Not game data; stored only locally. */

export type GoalScope = "account" | "character";

export interface Goal {
  id: string;
  /** account = every live character; character = one toon. */
  scope: GoalScope;
  characterId: string | null;
  /** Skill line name as the game reports it, e.g. "Assault", "Werewolf". */
  lineName: string;
  targetRank: number;
  note: string;
  createdAt: number;
}

export interface SkillLineChoice {
  name: string;
  category: string;
}

export interface GoalSubject {
  id: string;
  name: string;
  lastSeen: number | null;
  skillLines: { name: string; rank: number }[];
}

export type LineProgress =
  | { state: "done"; rank: number }
  | { state: "short"; rank: number }
  | { state: "undiscovered" }
  | { state: "unknown" };
