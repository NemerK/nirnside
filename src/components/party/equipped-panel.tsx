"use client";

import Link from "next/link";
import { GameIcon } from "../game-icon";
import { HoverTip } from "./hover-tip";

export interface EquippedPiece {
  slot: string;
  /** Short slot label shown under the tile ("Head", "Ring 1", "Main"). */
  label: string;
  name: string;
  icon: string | null;
  quality: string | null;
  trait: string | null;
  enchant: string | null;
  setName: string | null;
  setHref: string | null;
  /** Pieces of this set worn with this piece's bar out, and how many the set has bonuses up to. */
  setCount: number;
  setMax: number;
  bonuses: { pieces: number; text: string }[];
}

export interface EquippedSet {
  name: string;
  href: string | null;
  front: number;
  back: number | null;
  max: number;
}

const QUALITY_VAR: Record<string, string> = {
  trash: "var(--color-q-trash)",
  normal: "var(--color-q-normal)",
  fine: "var(--color-q-fine)",
  superior: "var(--color-q-superior)",
  epic: "var(--color-q-epic)",
  legendary: "var(--color-q-legendary)",
  mythic: "var(--color-q-mythic)",
};

function qualityColor(q: string | null): string {
  return (q && QUALITY_VAR[q.toLowerCase()]) || "var(--border-strong)";
}

function Tile({ p }: { p: EquippedPiece }) {
  const color = qualityColor(p.quality);
  const tip = (
    <>
      <span className="block text-[13.5px] font-medium" style={{ color }}>
        {p.name}
      </span>
      <span className="mt-0.5 block text-fg-subtle">
        {[p.slot, p.trait, p.quality ? p.quality[0].toUpperCase() + p.quality.slice(1) : null].filter(Boolean).join(" · ")}
      </span>
      {p.enchant ? <span className="mt-1.5 block text-fg-muted">{p.enchant}</span> : null}
      {p.setName ? (
        <span className="mt-2 block border-t border-border pt-2">
          <span className="flex justify-between gap-2">
            <span className="text-fg">{p.setName}</span>
            <span className="tabular-nums text-fg-subtle">
              {p.setCount}/{p.setMax || "?"} worn
            </span>
          </span>
          {p.bonuses.map((b) => (
            <span key={b.pieces} className={`mt-1 block ${p.setCount >= b.pieces ? "text-fg" : "text-fg-subtle"}`}>
              <span className="tabular-nums">({b.pieces})</span> {b.text}
            </span>
          ))}
        </span>
      ) : null}
    </>
  );
  const face = (
    <span className="flex w-[3.6rem] flex-col items-center gap-1">
      <span
        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-bg/70 transition-transform group-hover:-translate-y-0.5"
        style={{ boxShadow: `inset 0 0 0 1.5px ${color}, 0 0 0 3px color-mix(in srgb, ${color} 14%, transparent)` }}
      >
        <GameIcon name={p.name} icon={p.icon ?? undefined} size={36} bare />
      </span>
      <span className="w-full truncate text-center text-[11px] text-fg-subtle">{p.label}</span>
    </span>
  );
  return (
    <HoverTip tip={tip} className="group">
      {p.setHref ? (
        <Link href={p.setHref} aria-label={`${p.name}${p.setName ? `, ${p.setName}` : ""}`} className="block rounded-xl focus-visible:outline-2">
          {face}
        </Link>
      ) : (
        <span tabIndex={0} className="block rounded-xl" aria-label={p.name}>
          {face}
        </span>
      )}
    </HoverTip>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <span className="flex w-[3.6rem] flex-col items-center gap-1" title={`${label}: empty`}>
      <span className="h-11 w-11 rounded-xl border border-dashed border-border" />
      <span className="text-[11px] text-fg-subtle/70">{label}</span>
    </span>
  );
}

/**
 * What the character has on: armor and jewelry as tiles in their quality
 * color, both weapon bars, and the sets they add up to. Hover any piece for
 * its trait, enchant and set bonuses; click to open the set.
 */
export function EquippedPanel({
  armor,
  jewelry,
  front,
  back,
  sets,
}: {
  armor: (EquippedPiece | { empty: string })[];
  jewelry: (EquippedPiece | { empty: string })[];
  front: (EquippedPiece | { empty: string })[];
  back: (EquippedPiece | { empty: string })[];
  sets: EquippedSet[];
}) {
  const row = (items: (EquippedPiece | { empty: string })[]) =>
    items.map((p, i) => ("empty" in p ? <Empty key={`e-${p.empty}-${i}`} label={p.empty} /> : <Tile key={`${p.slot}-${i}`} p={p} />));
  return (
    <div>
      <div className="flex flex-wrap gap-x-0.5 gap-y-2">{row(armor)}</div>
      <div className="mt-3 flex flex-wrap items-start gap-x-5 gap-y-3">
        <div>
          <p className="mb-1 text-[11px] text-fg-subtle">Jewelry</p>
          <div className="flex gap-x-1">{row(jewelry)}</div>
        </div>
        <div>
          <p className="mb-1 text-[11px] text-fg-subtle">Front bar</p>
          <div className="flex gap-x-1">{row(front)}</div>
        </div>
        <div>
          <p className="mb-1 text-[11px] text-fg-subtle">Back bar</p>
          <div className="flex gap-x-1">{row(back)}</div>
        </div>
      </div>
      {sets.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-1.5 border-t border-border/60 pt-3">
          {sets.map((s) => {
            const full = s.max > 0 && s.front >= s.max;
            const body = (
              <>
                <span className="text-fg">{s.name}</span>
                <span className={`tabular-nums ${full ? "text-ok" : "text-fg-subtle"}`}>
                  {s.front}
                  {s.max ? `/${s.max}` : ""}
                  {s.back != null ? ` · back ${s.back}` : ""}
                </span>
              </>
            );
            return (
              <li key={s.name}>
                {s.href ? (
                  <Link href={s.href} className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2/70 px-2 py-1 text-[12px] hover:bg-surface-2">
                    {body}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2/70 px-2 py-1 text-[12px]">{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
