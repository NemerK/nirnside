/**
 * Item quality, lowest to highest, as the game ranks it. Mythic is the
 * game's display quality for mythic items (ITEM_DISPLAY_QUALITY_MYTHIC_OVERRIDE).
 * Colors come from the theme tokens --color-q-*; recipes report the game's
 * numeric quality (1 normal … 5 legendary).
 */
export const QUALITIES = ["trash", "normal", "fine", "superior", "epic", "legendary", "mythic"] as const;
export type Quality = (typeof QUALITIES)[number];

export const QUALITY_LABEL: Record<Quality, string> = {
  trash: "Trash",
  normal: "Normal",
  fine: "Fine",
  superior: "Superior",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

export function parseQuality(raw: string | number | null | undefined): Quality | null {
  if (raw == null) return null;
  if (typeof raw === "number") return (["trash", "normal", "fine", "superior", "epic", "legendary"] as const)[raw] ?? null;
  const n = raw.trim().toLowerCase();
  return (QUALITIES as readonly string[]).includes(n) ? (n as Quality) : null;
}

/** The theme color for a quality, as a CSS value. */
export function qualityColor(raw: string | number | null | undefined, fallback = "var(--border-strong)"): string {
  const q = parseQuality(raw);
  return q ? `var(--color-q-${q})` : fallback;
}

/** Tailwind classes, one per quality, so the build keeps them. */
const TEXT: Record<Quality, string> = {
  trash: "text-q-trash",
  normal: "text-q-normal",
  fine: "text-q-fine",
  superior: "text-q-superior",
  epic: "text-q-epic",
  legendary: "text-q-legendary",
  mythic: "text-q-mythic",
};
const BORDER: Record<Quality, string> = {
  trash: "border-q-trash",
  normal: "border-q-normal",
  fine: "border-q-fine",
  superior: "border-q-superior",
  epic: "border-q-epic",
  legendary: "border-q-legendary",
  mythic: "border-q-mythic",
};
const BORDER_SOFT: Record<Quality, string> = {
  trash: "border-q-trash/40",
  normal: "border-q-normal/40",
  fine: "border-q-fine/50",
  superior: "border-q-superior/50",
  epic: "border-q-epic/50",
  legendary: "border-q-legendary/60",
  mythic: "border-q-mythic/60",
};

export function qualityTextClass(raw: string | number | null | undefined, fallback = "text-fg"): string {
  const q = parseQuality(raw);
  return q ? TEXT[q] : fallback;
}
export function qualityBorderClass(raw: string | number | null | undefined, soft = false, fallback = "border-border"): string {
  const q = parseQuality(raw);
  return q ? (soft ? BORDER_SOFT[q] : BORDER[q]) : fallback;
}
