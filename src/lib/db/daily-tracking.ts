import { getMeta, setMeta } from "./index";
import { changeTracking, normalizeTracking, type DailyTracking } from "../party/daily-tracking";

const KEY = "daily-tracking";

export function getDailyTracking(): DailyTracking {
  try {
    return normalizeTracking(getMeta(KEY));
  } catch {
    return normalizeTracking(null);
  }
}

export function updateDailyTracking(change: Parameters<typeof changeTracking>[1]): DailyTracking {
  const next = changeTracking(getDailyTracking(), change);
  setMeta(KEY, next);
  return next;
}
