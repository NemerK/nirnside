import type { Character, House } from "../snapshot/schema";

/** Lines we will not invent a rank cap for. Unknown stays unknown. */
export type LivingCap = (name: string) => number | null;

export interface LivingFace {
  id: string;
  name: string;
  className: string;
  race: string;
  alliance: string;
  level: number;
  /** Class icon path, when we know one. */
  icon?: string;
  marks: string[];
  /** A real rank against a real cap. Absent when we would have to guess. */
  progress: { label: string; rank: number; total: number } | null;
  /** A quest still in motion, or the fact this character has never logged out. */
  open: string | null;
  wearing: string | null;
}

export interface LivingGuild {
  name: string;
  rank: string | null;
  trader: boolean;
}

export interface LivingHome {
  /** Roster order. The first recently-seen character is `faceId`. */
  faceId: string;
  faces: LivingFace[];
  house: { name: string; location: string | null; others: number } | null;
  guilds: LivingGuild[];
}

type FaceSource = Pick<
  Character,
  | "id"
  | "name"
  | "class"
  | "race"
  | "alliance"
  | "level"
  | "mundus"
  | "vampire"
  | "werewolf"
  | "classMastery"
  | "lastSeen"
  | "skillLines"
  | "equipped"
  | "dailies"
>;

const LEVEL_CAP = 50;

export function livingHome(characters: FaceSource[], houses: Pick<House, "name" | "location" | "primary">[], cap: LivingCap): LivingHome {
  const faces = characters.map((character) => faceOf(character, cap));
  const seen = characters.reduce<{ id: string; at: number } | null>((best, character) => {
    if (character.lastSeen == null) return best;
    if (!best || character.lastSeen > best.at) return { id: character.id, at: character.lastSeen };
    return best;
  }, null);
  const primary = houses.find((house) => house.primary) ?? houses[0] ?? null;
  return {
    faceId: seen?.id ?? faces[0]?.id ?? "",
    faces,
    house: primary
      ? {
          name: primary.name,
          location: primary.location?.trim() || null,
          others: Math.max(0, houses.length - 1),
        }
      : null,
    guilds: [],
  };
}

export function withGuilds(home: LivingHome, guilds: LivingGuild[]): LivingHome {
  return { ...home, guilds };
}

function faceOf(character: FaceSource, cap: LivingCap): LivingFace {
  const marks: string[] = [];
  if (character.vampire.isVampire) {
    marks.push(character.vampire.stage > 0 ? `Vampire, stage ${character.vampire.stage}` : "Vampire");
  }
  if (character.werewolf.isWerewolf) marks.push("Werewolf");
  if (character.mundus?.trim()) marks.push(character.mundus.trim());
  if (character.classMastery) marks.push("Class mastery");

  return {
    id: character.id,
    name: character.name,
    className: character.class,
    race: character.race,
    alliance: character.alliance,
    level: character.level,
    marks,
    progress: focusProgress(character, cap),
    open: openLine(character),
    wearing: wearingLine(character),
  };
}

function focusProgress(character: FaceSource, cap: LivingCap): LivingFace["progress"] {
  const unfinished = character.skillLines
    .map((line) => {
      const total = cap(line.name);
      if (total == null || line.rank >= total) return null;
      return { label: line.name, rank: line.rank, total, subclassed: line.subclassed };
    })
    .filter((line): line is { label: string; rank: number; total: number; subclassed: boolean } => line != null)
    .sort((a, b) => {
      if (a.subclassed !== b.subclassed) return a.subclassed ? -1 : 1;
      return b.rank / b.total - a.rank / a.total;
    });
  if (unfinished[0]) {
    const { label, rank, total } = unfinished[0];
    return { label, rank, total };
  }
  if (character.level > 0 && character.level < LEVEL_CAP) {
    return { label: "Level", rank: character.level, total: LEVEL_CAP };
  }
  return null;
}

function openLine(character: FaceSource): string | null {
  const dailies = character.dailies;
  if (dailies) {
    const named = [
      ...dailies.zoneDailies.map((quest) => questText(quest.name, quest.status, "zone")),
      ...dailies.pledges.map((pledge) => questText(pledge.dungeon?.trim() || pledge.giverName, pledge.status, "pledge")),
      ...dailies.writs.map((writ) => questText(writ.name, writ.status, "writ")),
      ...dailies.worldBosses.map((boss) => questText(boss.name, boss.status, "zone")),
    ].filter((line): line is { order: number; text: string } => line != null);
    named.sort((a, b) => a.order - b.order);
    if (named[0]) return named[0].text;
  }
  if (character.lastSeen == null) return "Has not logged out since the addon was installed.";
  return null;
}

function questText(name: string, status: string, kind: "zone" | "pledge" | "writ"): { order: number; text: string } | null {
  const title = name.trim();
  if (!title) return null;
  if (status === "accepted") {
    const text =
      kind === "pledge"
        ? `${title} pledge is accepted and not finished.`
        : `${title} is accepted and not finished.`;
    return { order: kind === "zone" ? 0 : kind === "pledge" ? 2 : 4, text };
  }
  if (status === "ready") {
    const text = kind === "pledge" ? `${title} pledge is ready to turn in.` : `${title} is ready.`;
    return { order: kind === "zone" ? 1 : kind === "pledge" ? 3 : 5, text };
  }
  return null;
}

function wearingLine(character: FaceSource): string | null {
  const sets: string[] = [];
  for (const item of character.equipped) {
    const name = item.setName?.trim();
    if (!name || sets.includes(name)) continue;
    sets.push(name);
    if (sets.length === 2) break;
  }
  if (sets.length === 0) return null;
  if (sets.length === 1) return `Wearing ${sets[0]}.`;
  return `Wearing ${sets[0]} and ${sets[1]}.`;
}
