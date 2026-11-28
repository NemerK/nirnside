import { countDown } from "../game/addons";
import { idleSlots } from "../game/research";
import type { Character } from "../snapshot/schema";
import { presentResearch } from "../knowledge/present";
import { type PresentedCharacterDailies, type DailyCell } from "../dailies/present";
import { WRIT_CRAFTS } from "../game/writs";

/**
 * Today: the handful of things that change between sessions, gathered from
 * the same presenters the Dailies, Crafting and Targets pages use — so the
 * numbers on Today always match the page they link to.
 */

export interface Tally {
  done: number;
  /** Cells we actually know about. Unknown cells are not counted as open. */
  total: number;
}

export interface TodayDailies {
  id: string;
  name: string;
  className: string;
  /** False when this character has not logged out since the reset. */
  scanned: boolean;
  randoms: Tally;
  writs: Tally;
  pledges: Tally;
}

export interface TodayResearchSlot {
  craftName: string;
  line: string;
  trait: string;
  /** Seconds left now, after the time since the snapshot. Null when unknown. */
  remaining: number | null;
}

export interface TodayResearch {
  id: string;
  name: string;
  className: string;
  running: TodayResearchSlot[];
  /** Research slots nobody is using, across every craft that reported its slot count. */
  idle: number;
}

function tally(cells: DailyCell[]): Tally {
  return {
    done: cells.filter((c) => c.status === "done" || c.status === "cooldown").length,
    total: cells.filter((c) => c.status !== "unknown").length,
  };
}

export function todayDailies(rows: PresentedCharacterDailies[]): TodayDailies[] {
  return rows.map((r) => ({
    id: r.characterId,
    name: r.name,
    className: r.className,
    scanned: r.scanned,
    randoms: r.scanned ? tally([r.randomNormal, r.randomVeteran]) : { done: 0, total: 0 },
    writs: r.scanned ? tally(WRIT_CRAFTS.map((c) => r.writs[c])) : { done: 0, total: 0 },
    pledges: r.scanned ? tally([r.pledges.maj, r.pledges.glirion, r.pledges.urgarlag]) : { done: 0, total: 0 },
  }));
}

/** True when everything we know about is finished (and we know something). */
export function tallyComplete(t: Tally): boolean {
  return t.total > 0 && t.done >= t.total;
}

type ResearchSource = Pick<Character, "id" | "name" | "class" | "research" | "lastSeen">;

/**
 * Research timers as of `nowUnix`. The snapshot stores time left at logout,
 * so the time since then is subtracted. A finished timer reads 0: the trait is
 * learned the next time the game checks, which we cannot see from here.
 */
export function todayResearch(characters: ResearchSource[], nowUnix: number): TodayResearch[] {
  const out: TodayResearch[] = [];
  for (const c of characters) {
    if (c.lastSeen == null) continue;
    const research = presentResearch(c.research);
    if (research.crafts.length === 0) continue;
    const elapsed = Math.max(0, nowUnix - c.lastSeen);
    const running = research.inProgress
      .map((slot) => ({
        craftName: slot.craftName,
        line: slot.line,
        trait: slot.trait,
        remaining: countDown(slot.remainingSeconds, elapsed),
      }))
      .sort((a, b) => (a.remaining ?? Infinity) - (b.remaining ?? Infinity));
    const idle = research.crafts.reduce(
      (sum, craft) => sum + (craft.maxSlots > 0 ? idleSlots(craft) : 0),
      0,
    );
    out.push({ id: c.id, name: c.name, className: c.class, running, idle });
  }
  return out;
}

/** "2d 4h", "5h 12m", "18m", "ready". */
export function formatTimeLeft(seconds: number | null): string {
  if (seconds == null) return "unknown";
  if (seconds <= 0) return "ready";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)}m`;
}
