/** ESO daily quests and dungeon rewards reset at 10:00 UTC. */
export const ESO_DAILY_RESET_HOUR_UTC = 10;

/** Calendar date of the ESO day that contains `unixSeconds` (UTC). */
export function esoDayKey(unixSeconds: number): string {
  const adjusted = unixSeconds - ESO_DAILY_RESET_HOUR_UTC * 3600;
  return new Date(adjusted * 1000).toISOString().slice(0, 10);
}

/** Unix seconds of the next 10:00 UTC reset after `unixSeconds`. */
export function nextEsoResetAt(unixSeconds: number): number {
  const secs = unixSeconds % 86400;
  const todayReset = unixSeconds - secs + ESO_DAILY_RESET_HOUR_UTC * 3600;
  return unixSeconds < todayReset ? todayReset : todayReset + 86400;
}

/** End of the ESO day labeled `dayKey` — 10:00 UTC on the following calendar date. */
export function resetAtForDayKey(dayKey: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!m) return 0;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return Math.floor(Date.UTC(y, mo - 1, d + 1, ESO_DAILY_RESET_HOUR_UTC, 0, 0) / 1000);
}

export function formatRemainingSeconds(total: number): string {
  const n = Math.max(0, Math.floor(total));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}
