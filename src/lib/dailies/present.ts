import type { Character, CharacterDailies, DailyPledge, DailyStatus, DailyWrit } from "../snapshot/schema";
import { esoDayKey } from "./day";
import { PLEDGE_GIVER_NAMES, type PledgeGiver } from "./pledges";

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
}

const UNKNOWN: DailyCell = {
  status: "unknown",
  label: "?",
  title: "Not scanned since reset",
};

function cell(status: DailyStatus, title: string, extra?: Partial<DailyCell>): DailyCell {
  const labels: Record<DailyStatus, string> = {
    available: "",
    accepted: "ACCEPT",
    ready: "TURN IN",
    done: "✓",
    // Random-dungeon cooldown means the daily reward is already claimed.
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

function pledgeCell(pledges: DailyPledge[] | undefined, giver: PledgeGiver): DailyCell {
  const row = pledges?.find((p) => p.giver === giver);
  const who = PLEDGE_GIVER_NAMES[giver];
  if (!row) return { ...UNKNOWN, title: `${who} — not scanned since reset` };
  const dungeon = row.dungeon || null;
  const where = dungeon ? `${who} — ${dungeon}` : who;
  if (row.status === "done") return cell("done", `${where} — done`, { dungeon });
  if (row.status === "ready") return cell("ready", `${where} — ready to turn in`, { dungeon });
  if (row.status === "accepted") return cell("accepted", `${where} — in journal`, { dungeon });
  if (row.status === "available") {
    return cell("unknown", `${who} — not in journal (turn-in not seen)`);
  }
  return cell("unknown", `${who} — not scanned since reset`);
}

function randomCell(
  kind: "Random Normal" | "Random Veteran",
  random: CharacterDailies["randomNormal"] | undefined,
): DailyCell {
  if (!random) return { ...UNKNOWN, title: `${kind} — not scanned since reset` };
  if (random.status === "done" || random.status === "cooldown") {
    return cell("done", `${kind} — done`);
  }
  if (random.status === "available") return cell("available", `${kind} — not done today`);
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
  };
}

/** After the 10:00 UTC reset, yesterday's checks clear. Empty ≠ scanned available. */
export function resetClearedCharacterDailies(
  character: Pick<Character, "id" | "name" | "class" | "lastSeen">,
  capturedAt: number | null,
): PresentedCharacterDailies {
  const reason = "cleared at the 10:00 UTC reset";
  const empty = cell("available", reason);
  return {
    characterId: character.id,
    name: character.name,
    className: character.class,
    stale: true,
    scanned: false,
    capturedAt,
    randomNormal: { ...empty, title: `Random Normal — ${reason}` },
    randomVeteran: { ...empty, title: `Random Veteran — ${reason}` },
    writs: Object.fromEntries(
      WRIT_CRAFTS.map((c) => [c, { ...empty, title: `${WRIT_LABELS[c]} — ${reason}` }]),
    ) as Record<WritCraft, DailyCell>,
    pledges: {
      maj: { ...empty, title: `${PLEDGE_GIVER_NAMES.maj} — ${reason}` },
      glirion: { ...empty, title: `${PLEDGE_GIVER_NAMES.glirion} — ${reason}` },
      urgarlag: { ...empty, title: `${PLEDGE_GIVER_NAMES.urgarlag} — ${reason}` },
    },
  };
}

/**
 * Board row for one character. A check is done today. After the 10:00 UTC
 * reset, yesterday's checks clear — we do not keep leftover timers or marks.
 */
export function presentCharacterDailies(
  character: Character,
  nowUnix: number,
  options?: { treatAsFresh?: boolean },
): PresentedCharacterDailies {
  const dailies = character.dailies;
  const neverLogged = character.lastSeen == null;
  if (neverLogged) {
    return unknownCharacterDailies(character, "not scanned since last login");
  }
  const stale = options?.treatAsFresh ? false : isDailyScanStale(dailies, nowUnix);
  if (!dailies) {
    return unknownCharacterDailies(
      character,
      "not scanned — update the Snapshot addon and log out once",
    );
  }
  if (stale) {
    return resetClearedCharacterDailies(character, dailies.capturedAt || character.lastSeen);
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
      maj: pledgeCell(dailies.pledges, "maj"),
      glirion: pledgeCell(dailies.pledges, "glirion"),
      urgarlag: pledgeCell(dailies.pledges, "urgarlag"),
    },
  };
}

export function presentAccountDailies(
  characters: Character[],
  nowUnix: number,
  options?: { treatAsFresh?: boolean },
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
} {
  const scanned = rows.filter((r) => r.scanned);
  const count = (cells: DailyCell[]) => ({
    done: cells.filter((c) => c.status === "done" || c.status === "cooldown").length,
    total: cells.filter((c) => c.status !== "unknown").length,
  });
  const randoms = count(scanned.flatMap((r) => [r.randomNormal, r.randomVeteran]));
  const writs = count(scanned.flatMap((r) => WRIT_CRAFTS.map((c) => r.writs[c])));
  const pledges = count(scanned.flatMap((r) => [r.pledges.maj, r.pledges.glirion, r.pledges.urgarlag]));
  return {
    scanned: scanned.length,
    total: rows.length,
    randomsDone: randoms.done,
    randomsTotal: randoms.total,
    writsDone: writs.done,
    writsTotal: writs.total,
    pledgesDone: pledges.done,
    pledgesTotal: pledges.total,
  };
}
