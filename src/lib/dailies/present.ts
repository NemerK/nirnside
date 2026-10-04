import type { Character, CharacterDailies, DailyPledge, DailyStatus, DailyWorldBoss, DailyWrit } from "../snapshot/schema";
import { esoDayKey } from "./day";
import { PLEDGE_GIVER_NAMES, sameDungeon, type PledgeGiver } from "./pledges";
import { WORLD_BOSS_ZONES, type WorldBossZoneId } from "./world-bosses";

export const WRIT_CRAFTS = [
  "blacksmithing",
  "clothing",
  "woodworking",
  "enchanting",
  "alchemy",
  "provisioning",
  "jewelry",
] as const;
export type WritCraft = (typeof WRIT_CRAFTS)[number];

export const WRIT_LABELS: Record<WritCraft, string> = {
  blacksmithing: "Blacksmith",
  clothing: "Clothier",
  woodworking: "Woodworker",
  enchanting: "Enchanter",
  alchemy: "Alchemist",
  provisioning: "Provisioner",
  jewelry: "Jewelry",
};

export const WRIT_ABBR: Record<WritCraft, string> = {
  blacksmithing: "BS",
  clothing: "CL",
  woodworking: "WW",
  enchanting: "EN",
  alchemy: "AL",
  provisioning: "PR",
  jewelry: "JW",
};

export interface DailyCell {
  status: DailyStatus;
  label: string;
  title: string;
  dungeon?: string | null;
  remainingSeconds?: number;
  difficulty?: "normal" | "veteran" | null;
  hardMode?: boolean | null;
}

export interface PresentedCharacterDailies {
  characterId: string;
  name: string;
  className: string;
  stale: boolean;
  scanned: boolean;
  capturedAt: number | null;
  randomNormal: DailyCell;
  randomVeteran: DailyCell;
  writs: Record<WritCraft, DailyCell>;
  pledges: Record<PledgeGiver, DailyCell>;
  worldBosses: Record<WorldBossZoneId, DailyCell>;
}

const UNKNOWN: DailyCell = {
  status: "unknown",
  label: "?",
  title: "Not scanned since reset",
};

function cell(status: DailyStatus, title: string, extra?: Partial<DailyCell>): DailyCell {
  const labels: Record<DailyStatus, string> = {
    available: "—",
    accepted: "ACCEPT",
    ready: "TURN IN",
    done: "✓",
    cooldown: "✓",
    unknown: "?",
  };
  return { status, label: labels[status], title, ...extra };
}

export function isDailyScanStale(
  dailies: CharacterDailies | null | undefined,
  nowUnix: number,
): boolean {
  if (!dailies) return true;
  if (dailies.resetAt > 0 && nowUnix >= dailies.resetAt) return true;
  if (dailies.dayKey && dailies.dayKey !== esoDayKey(nowUnix)) return true;
  return false;
}

function writCell(writs: DailyWrit[] | undefined, craft: WritCraft): DailyCell {
  const row = writs?.find((w) => w.craft === craft);
  if (!row) return { ...UNKNOWN, title: `${WRIT_LABELS[craft]} — not scanned since reset` };
  const name = row.name || WRIT_LABELS[craft];
  if (row.status === "done") return cell("done", `${name} — done`);
  if (row.status === "ready") return cell("ready", `${name} — ready to turn in`);
  if (row.status === "accepted") return cell("accepted", `${name} — in journal`);
  // 0.9.19 wrote "available" when the writ was simply missing from the journal.
  // That is not proof it can still be picked up — turn-in leaves the book.
  if (row.status === "available") {
    return cell("unknown", `${name} — not in journal (turn-in not seen)`);
  }
  return cell("unknown", `${name} — not scanned since reset`);
}

function pledgeModeNote(row: DailyPledge): string {
  if (row.hardMode === true) return " — hard mode";
  if (row.difficulty === "veteran") return " — veteran";
  if (row.difficulty === "normal" || row.hardMode === false) return " — normal";
  return "";
}

function pledgeModeExtra(row: DailyPledge): Partial<DailyCell> {
  return {
    dungeon: row.dungeon || null,
    difficulty: row.difficulty ?? null,
    hardMode: row.hardMode ?? (row.difficulty === "normal" ? false : null),
  };
}

function pledgeCell(
  pledges: DailyPledge[] | undefined,
  giver: PledgeGiver,
  todayDungeon?: string,
): DailyCell {
  const row = pledges?.find((p) => p.giver === giver);
  const who = PLEDGE_GIVER_NAMES[giver];
  if (!row) return { ...UNKNOWN, title: `${who} — not scanned since reset` };
  const where = row.dungeon ? `${who} — ${row.dungeon}` : who;
  const extra = pledgeModeExtra(row);
  const note = pledgeModeNote(row);
  if (row.status === "done") {
    return cell(
      "done",
      note ? `${where} — done${note}` : `${where} — done (mode not captured)`,
      extra,
    );
  }
  if (row.status === "ready") return cell("ready", `${where} — ready to turn in${note}`, extra);
  if (row.status === "accepted") {
    // ACCEPT is journal-only. A leftover QUEST_ADDED flag after turn-in is not
    // "in the book" — old scans left that lie on the wrong giver.
    if (row.inJournal !== true) {
      if (row.hardMode != null || row.difficulty) return cell("done", `${where} — done${note}`, extra);
      return cell("unknown", `${where} — not in journal`);
    }
    if (todayDungeon && row.dungeon && !sameDungeon(row.dungeon, todayDungeon)) {
      return cell("unknown", `${where} — leftover (today is ${todayDungeon})`, extra);
    }
    return cell("accepted", `${where} — in journal`, extra);
  }
  if (row.status === "available") {
    return cell("unknown", `${who} — not in journal (turn-in not seen)`);
  }
  return cell("unknown", `${who} — not scanned since reset`);
}

function worldBossCell(rows: DailyWorldBoss[] | undefined, zone: WorldBossZoneId): DailyCell {
  const meta = WORLD_BOSS_ZONES.find((z) => z.id === zone);
  const label = meta?.name ?? zone;
  const hits = (rows ?? []).filter((r) => r.zone === zone);
  if (hits.length === 0) return { ...UNKNOWN, title: `${label} — not scanned since reset` };
  const done = hits.find((r) => r.status === "done");
  if (done) return cell("done", `${label} — ${done.name || "world boss"} — done`);
  const ready = hits.find((r) => r.status === "ready");
  if (ready) return cell("ready", `${label} — ${ready.name || "world boss"} — ready to turn in`);
  const accepted = hits.find((r) => r.status === "accepted");
  if (accepted) return cell("accepted", `${label} — ${accepted.name || "world boss"} — in journal`);
  return cell("unknown", `${label} — not in journal`);
}

function emptyWorldBosses(reason: string): Record<WorldBossZoneId, DailyCell> {
  return Object.fromEntries(
    WORLD_BOSS_ZONES.map((z) => [z.id, { ...UNKNOWN, title: `${z.name} — ${reason}` }]),
  ) as Record<WorldBossZoneId, DailyCell>;
}

function randomCell(
  kind: "Random Normal" | "Random Veteran",
  random: CharacterDailies["randomNormal"] | undefined,
): DailyCell {
  if (!random) return { ...UNKNOWN, title: `${kind} — not scanned since reset` };
  if (random.status === "done" || random.status === "cooldown") {
    return cell("done", `${kind} — daily reward claimed`);
  }
  if (random.status === "available") return cell("available", `${kind} — daily reward available`);
  return cell("unknown", `${kind} — not scanned since reset`);
}

export function unknownCharacterDailies(
  character: Pick<Character, "id" | "name" | "class" | "lastSeen">,
  reason: string,
): PresentedCharacterDailies {
  const u = { ...UNKNOWN, title: reason };
  return {
    characterId: character.id,
    name: character.name,
    className: character.class,
    stale: true,
    scanned: false,
    capturedAt: character.lastSeen,
    randomNormal: u,
    randomVeteran: u,
    writs: Object.fromEntries(WRIT_CRAFTS.map((c) => [c, { ...u, title: `${WRIT_LABELS[c]} — ${reason}` }])) as Record<
      WritCraft,
      DailyCell
    >,
    pledges: {
      maj: { ...u, title: `${PLEDGE_GIVER_NAMES.maj} — ${reason}` },
      glirion: { ...u, title: `${PLEDGE_GIVER_NAMES.glirion} — ${reason}` },
      urgarlag: { ...u, title: `${PLEDGE_GIVER_NAMES.urgarlag} — ${reason}` },
    },
    worldBosses: emptyWorldBosses(reason),
  };
}

/**
 * Board row for one character. After daily reset, every cell is unknown with a
 * timestamp — we do not pretend yesterday's leftovers are still available.
 */
export function presentCharacterDailies(
  character: Character,
  nowUnix: number,
  options?: { treatAsFresh?: boolean; todayPledges?: Record<PledgeGiver, string> },
): PresentedCharacterDailies {
  const dailies = character.dailies;
  const neverLogged = character.lastSeen == null;
  if (neverLogged) {
    return unknownCharacterDailies(character, "not scanned since last login");
  }
  const stale = options?.treatAsFresh ? false : isDailyScanStale(dailies, nowUnix);
  if (!dailies || stale) {
    const reason = dailies
      ? "not scanned since reset"
      : "not scanned — update the Snapshot addon and log out once";
    return unknownCharacterDailies(character, reason);
  }
  return {
    characterId: character.id,
    name: character.name,
    className: character.class,
    stale: false,
    scanned: true,
    capturedAt: dailies.capturedAt || character.lastSeen,
    randomNormal: randomCell("Random Normal", dailies.randomNormal),
    randomVeteran: randomCell("Random Veteran", dailies.randomVeteran),
    writs: Object.fromEntries(WRIT_CRAFTS.map((c) => [c, writCell(dailies.writs, c)])) as Record<WritCraft, DailyCell>,
    pledges: {
      maj: pledgeCell(dailies.pledges, "maj", options?.todayPledges?.maj),
      glirion: pledgeCell(dailies.pledges, "glirion", options?.todayPledges?.glirion),
      urgarlag: pledgeCell(dailies.pledges, "urgarlag", options?.todayPledges?.urgarlag),
    },
    worldBosses: Object.fromEntries(
      WORLD_BOSS_ZONES.map((z) => [z.id, worldBossCell(dailies.worldBosses, z.id)]),
    ) as Record<WorldBossZoneId, DailyCell>,
  };
}

export function presentAccountDailies(
  characters: Character[],
  nowUnix: number,
  options?: { treatAsFresh?: boolean; todayPledges?: Record<PledgeGiver, string> },
): PresentedCharacterDailies[] {
  return characters.map((c) => presentCharacterDailies(c, nowUnix, options));
}

export function dailiesHaveAnyScan(characters: Character[]): boolean {
  return characters.some((c) => c.dailies != null && c.lastSeen != null);
}

export function summarizeDailies(rows: PresentedCharacterDailies[]): {
  scanned: number;
  total: number;
  randomsDone: number;
  randomsTotal: number;
  writsDone: number;
  writsTotal: number;
  pledgesDone: number;
  pledgesTotal: number;
  worldBossesDone: number;
  worldBossesTotal: number;
} {
  const scanned = rows.filter((r) => r.scanned);
  const count = (cells: DailyCell[]) => ({
    done: cells.filter((c) => c.status === "done" || c.status === "cooldown").length,
    total: cells.filter((c) => c.status !== "unknown").length,
  });
  const randoms = count(scanned.flatMap((r) => [r.randomNormal, r.randomVeteran]));
  const writs = count(scanned.flatMap((r) => WRIT_CRAFTS.map((c) => r.writs[c])));
  const pledges = count(scanned.flatMap((r) => [r.pledges.maj, r.pledges.glirion, r.pledges.urgarlag]));
  const bosses = count(scanned.flatMap((r) => WORLD_BOSS_ZONES.map((z) => r.worldBosses[z.id])));
  return {
    scanned: scanned.length,
    total: rows.length,
    randomsDone: randoms.done,
    randomsTotal: randoms.total,
    writsDone: writs.done,
    writsTotal: writs.total,
    pledgesDone: pledges.done,
    pledgesTotal: pledges.total,
    worldBossesDone: bosses.done,
    worldBossesTotal: bosses.total,
  };
}
