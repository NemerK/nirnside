import { findAlliance, type Alliance } from "./game/character";
import { qualityBorderClass, qualityTextClass } from "./game/quality";
import type { ItemQuality } from "./snapshot/schema";

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatGold(n: number): string {
  return `${formatNumber(n)}g`;
}

/** Human "time ago" for snapshot timestamps (unix seconds). */
export function timeAgo(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) return "never";
  const diff = Date.now() / 1000 - unixSeconds;
  if (diff < 60) return "just now";
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function formatDateTime(unixSeconds: number | null | undefined): string {
  if (!unixSeconds) return "—";
  return new Date(unixSeconds * 1000).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function qualityText(q: ItemQuality | null | undefined): string {
  return qualityTextClass(q);
}

export function qualityBorder(q: ItemQuality | null | undefined): string {
  return qualityBorderClass(q, true);
}

export const LOCATION_LABELS: Record<string, string> = {
  worn: "Worn",
  backpack: "Backpack",
  bank: "Bank",
  subscriberBank: "Subscriber Bank",
  craftBag: "Craft Bag",
};

export function locationLabel(loc: string): string {
  return LOCATION_LABELS[loc] ?? loc;
}

/** Each alliance's color, keyed by the model's alliances (game/character.ts). */
export const ALLIANCE_ACCENT: Record<Alliance, string> = {
  "Aldmeri Dominion": "#e3c34a",
  "Daggerfall Covenant": "#3f7fd6",
  "Ebonheart Pact": "#c0453b",
};

/** An alliance's color from any spelling of its name; undefined when it isn't one. */
export function allianceAccent(name: string | null | undefined): string | undefined {
  const a = findAlliance(name);
  return a ? ALLIANCE_ACCENT[a] : undefined;
}
