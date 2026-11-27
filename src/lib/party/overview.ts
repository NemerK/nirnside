import "server-only";
import { countDown } from "../game/addons";
import { idleSlots } from "../game/research";
import { getDb } from "../db";
import {
  getAccount,
  getCompletedAchievementIds,
  getDataSource,
  getOutfitStyles,
  getStickerbookStats,
} from "../db/queries";
import { ACCOUNT_CURRENCIES, canonicalizeCurrencies } from "../currencies";
import { accountAlliancePoints, accountTelVar, goldBreakdown } from "../snapshot/roster";
import { presentOutfitStyles, presentResearch } from "../knowledge/present";
import { currentUnix, type EsoRegion } from "../dailies/day";
import { communityPledgesForUnix } from "../dailies/pledges";
import { presentAccountDailies, summarizeDailies } from "../dailies/present";
import { PITHKA_TABS, allTrackedIds } from "../achievements/pithka";
import type { Character } from "../snapshot/schema";
import type { AccountMeta as Account } from "../db/queries";
import { compareLines, craftingCharacters, dailiesCharacters, lightSubjects, roster } from "./data";
import { listGoals } from "../db/goals";
import { listRoles } from "../db/roles";
import { goalCardsForClient, type PlannerData } from "../planner/data";
import { reviewTargets } from "../goals/review";

/**
 * Account-level facts shared by the profile showcase, Inventory and the
 * Roster table. Each reads only what it needs.
 */

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export function account(): Account | null {
  return safe(() => getAccount(), null);
}

export interface Treasury {
  gold: number;
  bankGold: number;
  currencies: { key: string; label: string; value: number }[];
}

export function treasury(a: Account, characters: Character[]): Treasury {
  const gold = goldBreakdown({ characters, bankGold: a.currencies?.bankGold ?? 0, legacyGold: a.gold });
  const wallet: Record<string, number> = {
    ...canonicalizeCurrencies(a.currencies),
    alliancePoints: accountAlliancePoints({ characters, legacyAlliancePoints: a.currencies?.alliancePoints }),
    telVar: accountTelVar({ characters, legacyTelVar: a.currencies?.telVar }),
  };
  return {
    gold: gold.total,
    bankGold: gold.bank,
    currencies: ACCOUNT_CURRENCIES.filter((c) => c.always || (wallet[c.key] ?? 0) > 0).map((c) => ({
      key: c.key,
      label: c.label,
      value: wallet[c.key] ?? 0,
    })),
  };
}

export interface RosterRow {
  id: string;
  name: string;
  className: string;
  race: string;
  level: number;
  championPoints: number;
  gold: number | null;
  lastSeen: number | null;
  /** Today's dailies: null when not logged out since the reset. */
  dailies: { done: number; total: number } | null;
  research: { idle: number; finished: number } | null;
}

/** One row per character: the at-a-glance table on the Roster. */
export function rosterRows(a: Account | null): RosterRow[] {
  const characters = roster();
  const now = currentUnix();
  const region: EsoRegion = a?.region === "NA" ? "NA" : "EU";
  const isSample = safe(() => getDataSource(), null)?.kind === "sample";
  const daily = new Map(
    presentAccountDailies(dailiesCharacters(), now, {
      treatAsFresh: isSample,
      todayPledges: communityPledgesForUnix(now, region),
      region,
    }).map((r) => {
      const s = summarizeDailies([r]);
      const done = s.randomsDone + s.writsDone + s.pledgesDone + s.worldBossesDone;
      const total = s.randomsTotal + s.writsTotal + s.pledgesTotal + s.worldBossesTotal;
      return [r.characterId, s.scanned === 0 ? null : { done, total }];
    }),
  );
  const research = new Map(
    craftingCharacters().map((c) => {
      const r = presentResearch(c.research);
      if (r.crafts.length === 0) return [c.id, null];
      // Research keeps running after logout: count what has finished since.
      const elapsed = c.lastSeen != null ? Math.max(0, now - c.lastSeen) : 0;
      const finished = r.inProgress.filter((x) => countDown(x.remainingSeconds, elapsed) === 0).length;
      const idle = r.crafts.reduce((n, cr) => n + idleSlots(cr), 0);
      return [c.id, { idle, finished }];
    }),
  );
  return characters.map((c) => ({
    id: c.id,
    name: c.name,
    className: c.class,
    race: c.race,
    level: c.level,
    championPoints: c.championPoints,
    gold: c.lastSeen == null ? null : (c.gold ?? 0),
    lastSeen: c.lastSeen,
    dailies: daily.get(c.id) ?? null,
    research: research.get(c.id) ?? null,
  }));
}

export interface CollectionsSummary {
  pieces: { collected: number; total: number };
  closest: { name: string; collected: number; total: number }[];
  styles: { unlocked: number; total: number };
  mythics: { name: string; got: number; total: number; collected: boolean }[];
}

export function collectionsSummary(a: Account): CollectionsSummary {
  const sticker = safe(() => getStickerbookStats(), { total: 0, collected: 0, sets: 0 });
  const closest = safe(
    () =>
      getDb()
        .prepare(
          "SELECT name, collected, total FROM stickerbook WHERE collected < total ORDER BY (total - collected) ASC, name ASC LIMIT 4",
        )
        .all() as { name: string; collected: number; total: number }[],
    [],
  );
  const styles = presentOutfitStyles(safe(() => getOutfitStyles(), []));
  return {
    pieces: { collected: sticker.collected, total: sticker.total },
    closest,
    styles: { unlocked: styles.unlocked, total: styles.total },
    mythics: (a.mythics ?? []).map((m) => ({
      name: m.name,
      got: m.leads.filter((l) => l.recovered).length,
      total: m.leads.length,
      collected: m.collected,
    })),
  };
}

export function achievementsSummary(): { label: string; done: number; total: number }[] {
  const done = new Set(safe(() => getCompletedAchievementIds(), []));
  return PITHKA_TABS.map((t) => {
    const ids = allTrackedIds(t.rows);
    return { label: t.id, done: ids.filter((id) => done.has(id)).length, total: ids.length };
  });
}

export interface PlanRow {
  id: string;
  name: string;
  className: string;
  essential: { done: number; total: number };
  all: { done: number; total: number };
}

/**
 * Per character: how many of their targets are met. Judged from skill-line
 * ranks only (cheap); ability and script targets count once snapshots load.
 */
export function planProgress(): PlanRow[] {
  const goals = safe(() => listGoals(), []);
  if (goals.length === 0) return [];
  const roles = safe(() => listRoles(), []).map((r) => ({ id: r.id, name: r.name }));
  const characters = roster();
  const { lineIndex } = compareLines(characters);
  const subjects = lightSubjects();
  const data = { subjects, lineIndex, abilityIndex: [] } as unknown as PlannerData;
  const cards = goalCardsForClient(goals, data);
  const groups = reviewTargets({ goals, cards, subjects, roles });
  const rows = new Map(
    subjects.map((s) => [
      s.id,
      { id: s.id, name: s.name, className: s.className, essential: { done: 0, total: 0 }, all: { done: 0, total: 0 } },
    ]),
  );
  for (const t of groups.flatMap((g) => g.targets)) {
    for (const p of t.people) {
      const row = rows.get(p.id);
      if (!row || p.mark.state === "unknown") continue;
      const done = p.mark.state === "done" ? 1 : 0;
      row.all.total += 1;
      row.all.done += done;
      if (t.goal.tier === "essential") {
        row.essential.total += 1;
        row.essential.done += done;
      }
    }
  }
  return [...rows.values()];
}
