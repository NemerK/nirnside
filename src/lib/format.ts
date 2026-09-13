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

const QUALITY_TEXT: Record<ItemQuality, string> = {
  trash: "text-q-trash",
  normal: "text-q-normal",
  fine: "text-q-fine",
  superior: "text-q-superior",
  epic: "text-q-epic",
  legendary: "text-q-legendary",
  mythic: "text-q-mythic",
};

const QUALITY_BORDER: Record<ItemQuality, string> = {
  trash: "border-q-trash/40",
  normal: "border-q-normal/40",
  fine: "border-q-fine/50",
  superior: "border-q-superior/50",
  epic: "border-q-epic/50",
  legendary: "border-q-legendary/60",
  mythic: "border-q-mythic/60",
};

export function qualityText(q: ItemQuality | null | undefined): string {
  return q ? QUALITY_TEXT[q] : "text-fg";
}

export function qualityBorder(q: ItemQuality | null | undefined): string {
  return q ? QUALITY_BORDER[q] : "border-border";
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

export const ALLIANCE_ACCENT: Record<string, string> = {
  "Aldmeri Dominion": "#e3c34a",
  "Daggerfall Covenant": "#3f7fd6",
  "Ebonheart Pact": "#c0453b",
};
