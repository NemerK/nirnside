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
  championPoints: number;
  /** Class icon path, when we know one. */
  icon?: string;
  marks: string[];
  /** A real rank against a real cap. Absent when we would have to guess. */
  progress: { label: string; rank: number; total: number } | null;
  /** A quest still in motion, or the fact this character has never logged out. */
  open: string | null;
  /** The same fact, split so a profile can show a title and a detail. */
  activity: { title: string; detail: string } | null;
  /** Up to two worn set names, in the order they appear on the character. */
  sets: string[];
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
  | "championPoints"
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
    championPoints: character.championPoints,
    marks,
    progress: focusProgress(character, cap),
    ...openFact(character),
    sets: wornSets(character),
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

function openFact(character: FaceSource): Pick<LivingFace, "open" | "activity"> {
  const dailies = character.dailies;
  if (dailies) {
    const named = [
      ...dailies.zoneDailies.map((quest) => questText(quest.name, quest.status, "zone")),
      ...dailies.pledges.map((pledge) => questText(pledge.dungeon?.trim() || pledge.giverName, pledge.status, "pledge")),
      ...dailies.writs.map((writ) => questText(writ.name, writ.status, "writ")),
      ...dailies.worldBosses.map((boss) => questText(boss.name, boss.status, "zone")),
    ].filter((line): line is QuestLine => line != null);
    named.sort((a, b) => a.order - b.order);
    const best = named[0];
    if (best) return { open: best.sentence, activity: { title: best.title, detail: best.detail } };
  }
  if (character.lastSeen == null) {
    return {
      open: "Has not logged out since the addon was installed.",
      activity: { title: "Not logged out yet", detail: "Since the addon was installed" },
    };
  }
  return { open: null, activity: null };
}

interface QuestLine {
  order: number;
  title: string;
  detail: string;
  sentence: string;
}

function questText(name: string, status: string, kind: "zone" | "pledge" | "writ"): QuestLine | null {
  const title = name.trim();
  if (!title) return null;
  const heading = kind === "pledge" ? `${title} pledge` : title;
  const order = kind === "zone" ? 0 : kind === "pledge" ? 2 : 4;
  if (status === "accepted") {
    return {
      order,
      title: heading,
      detail: "Accepted and not finished",
      sentence: kind === "pledge" ? `${title} pledge is accepted and not finished.` : `${title} is accepted and not finished.`,
    };
  }
  if (status === "ready") {
    return {
      order: order + 1,
      title: heading,
      detail: kind === "pledge" ? "Ready to turn in" : "Ready",
      sentence: kind === "pledge" ? `${title} pledge is ready to turn in.` : `${title} is ready.`,
    };
  }
  return null;
}

function wornSets(character: FaceSource): string[] {
  const sets: string[] = [];
  for (const item of character.equipped) {
    const name = item.setName?.trim();
    if (!name || sets.includes(name)) continue;
    sets.push(name);
    if (sets.length === 2) break;
  }
  return sets;
}

function wearingLine(character: FaceSource): string | null {
  const sets = wornSets(character);
  if (sets.length === 0) return null;
  if (sets.length === 1) return `Wearing ${sets[0]}.`;
  return `Wearing ${sets[0]} and ${sets[1]}.`;
}
