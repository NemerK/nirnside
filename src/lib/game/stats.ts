import type { CharacterStats, StatEffect } from "../snapshot/schema";

/**
 * Stat values: a character's sheet and what an ability adds to it.
 *
 * Sources: the game's own Stats and Advanced Stats windows (esoui/esoui
 * 12.1.7, ingame/stats/keyboard/zo_stats_keyboard.lua) and the ESOUI API for
 * 101051. Every number and name here is the game's, saved by Snapshot 0.9.46+
 * and Catalog 0.2.9+. This module only words them the way the window does:
 *
 * - main rows (GetPlayerStat) are whole numbers;
 * - an Advanced Stat shows by its format: flat, percent, flat and percent
 *   side by side, or percent with the flat value behind it.
 *
 * Nothing here works a value out. The game's value already includes whatever
 * was active at the save (food, Mundus, passives), like its own window.
 */

export type StatFormat = "flat" | "percent" | "flatAndPercent" | "flatOrPercent";

/** A whole number with grouping, as the game's window prints it. */
function whole(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** "55.2%", "11%": the game shows a percent with up to one decimal. */
export function formatPercent(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}%`;
}

/** A readable name for a stat the game didn't name ("critical_damage" → "Critical Damage"). */
export function labelFromKey(key: string | null | undefined): string {
  return (key ?? "")
    .split("_")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export interface StatValue {
  key: string;
  label: string;
  /** The value as the game's window shows it ("21,918 (55.2%)"). */
  text: string;
  /** The number to compare by: the flat value, else the percent. */
  value: number | null;
  percent: number | null;
}

export interface StatsReading {
  /** The Stats window's rows, in its order. */
  main: StatValue[];
  /** Advanced Stats, by the game's categories, in its order. */
  advanced: { category: string; stats: StatValue[] }[];
}

function advancedText(format: string | null | undefined, flat: number | null, percent: number | null): string {
  if (format === "flat") return flat != null ? whole(flat) : "";
  if (format === "flatAndPercent") {
    if (flat != null && percent != null) return `${whole(flat)} (${formatPercent(percent)})`;
  }
  if (percent != null) return formatPercent(percent);
  return flat != null ? whole(flat) : "";
}

export function readStats(stats: CharacterStats | null | undefined): StatsReading | null {
  if (!stats || (stats.main.length === 0 && stats.advanced.length === 0)) return null;
  const main: StatValue[] = stats.main.map((s) => ({
    key: s.key,
    label: s.label || labelFromKey(s.key),
    text: whole(s.value),
    value: s.value,
    percent: null,
  }));
  const advanced: StatsReading["advanced"] = [];
  for (const a of stats.advanced) {
    const category = a.category || "Other";
    let group = advanced.find((g) => g.category === category);
    if (!group) {
      group = { category, stats: [] };
      advanced.push(group);
    }
    const flat = a.flat ?? null;
    const percent = a.percent ?? null;
    const text = advancedText(a.format, flat, percent);
    if (!text) continue;
    group.stats.push({
      key: a.key ?? String(a.stat),
      label: a.label || labelFromKey(a.key),
      text,
      value: flat ?? percent,
      percent,
    });
  }
  return { main, advanced: advanced.filter((g) => g.stats.length > 0) };
}

/** One stat by the game's constant name, main rows first, then Advanced Stats. */
export function findStat(reading: StatsReading | null, key: string): StatValue | null {
  if (!reading) return null;
  return (
    reading.main.find((s) => s.key === key) ??
    reading.advanced.flatMap((g) => g.stats).find((s) => s.key === key) ??
    null
  );
}

/** "+11% Critical Damage", "+238 Weapon and Spell Damage". */
export function effectText(e: StatEffect): string {
  const label = e.label || labelFromKey(e.key);
  const percent = e.format === "percent" || e.format === "flatOrPercent";
  const sign = e.value > 0 ? "+" : "";
  return `${sign}${percent ? formatPercent(e.value) : whole(e.value)} ${label}`.trim();
}

export function effectsText(effects: readonly StatEffect[] | null | undefined): string | null {
  const parts = (effects ?? []).map(effectText).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
