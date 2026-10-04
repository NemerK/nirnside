/**
 * Daily quests, writs, pledges, dungeon rewards, and Endeavors reset on the
 * megaserver clock (ZOS / ESO-Hub / UESP):
 *   EU  03:00 UTC
 *   NA  10:00 UTC
 * Weekly trials reset Tuesday at the same hour. Do not use a single 10:00 UTC
 * clock — that is NA only, and it made the EU board flip seven hours late.
 */

export type EsoRegion = "EU" | "NA";

export const ESO_DAILY_RESET_HOUR_UTC: Record<EsoRegion, number> = {
  EU: 3,
  NA: 10,
};

export function dailyResetHourUtc(region: EsoRegion = "EU"): number {
  return ESO_DAILY_RESET_HOUR_UTC[region] ?? ESO_DAILY_RESET_HOUR_UTC.EU;
}

/** Calendar date of the ESO day that contains `unixSeconds` on that megaserver. */
export function esoDayKey(unixSeconds: number, region: EsoRegion = "EU"): string {
  const adjusted = unixSeconds - dailyResetHourUtc(region) * 3600;
  return new Date(adjusted * 1000).toISOString().slice(0, 10);
}

/** Unix seconds of the next megaserver daily reset after `unixSeconds`. */
export function nextEsoResetAt(unixSeconds: number, region: EsoRegion = "EU"): number {
  const hour = dailyResetHourUtc(region);
  const secs = unixSeconds % 86400;
  const todayReset = unixSeconds - secs + hour * 3600;
  return unixSeconds < todayReset ? todayReset : todayReset + 86400;
}

/** End of the ESO day labeled `dayKey` — next reset after that civil date. */
export function resetAtForDayKey(dayKey: string, region: EsoRegion = "EU"): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!m) return 0;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return Math.floor(Date.UTC(y, mo - 1, d + 1, dailyResetHourUtc(region), 0, 0) / 1000);
}

export function formatRemainingSeconds(total: number): string {
  const n = Math.max(0, Math.floor(total));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}
