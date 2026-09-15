"use client";

import { useState } from "react";

/**
 * Icon rendering. ESO exposes icons as in-game .dds texture paths (e.g.
 * "/esoui/art/icons/ability_mageguild_meteor.dds"). We never extract or bundle
 * the game's art. Instead we resolve those paths against a public icon mirror
 * (UESP's esoicons host, the de-facto community CDN) which serves PNG versions
 * at the same path. If no icon path is known, or the image fails to load, we
 * fall back to a tasteful deterministic placeholder from the entry's initials.
 *
 * The base is overridable via NEXT_PUBLIC_NIRNSIDE_ICON_BASE for anyone who
 * wants to self-host the icons instead of hotlinking.
 */
const ICON_BASE = process.env.NEXT_PUBLIC_NIRNSIDE_ICON_BASE || "https://esoicons.uesp.net";

function resolveIconUrl(icon: string): string | null {
  if (!icon) return null;
  if (/^https?:\/\//i.test(icon)) return icon;
  let p = icon.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
  if (!p.startsWith("esoui/")) {
    // Bare filename or partial path — assume the standard icons directory.
    if (!p.includes("/")) p = `esoui/art/icons/${p}`;
  }
  if (p.endsWith(".dds")) p = `${p.slice(0, -4)}.png`;
  else if (!/\.(png|jpg|jpeg|webp)$/.test(p)) p = `${p}.png`;
  return `${ICON_BASE.replace(/\/$/, "")}/${p}`;
}

function initials(name: string): string {
  const words = name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function hueFrom(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function GameIcon({
  name,
  icon,
  size = 40,
  className = "",
}: {
  name: string;
  icon?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = icon ? resolveIconUrl(icon) : null;

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-md border border-border bg-surface-2 object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const hue = hueFrom(name);
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-md border border-border font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(140deg, hsl(${hue} 45% 22%), hsl(${(hue + 40) % 360} 45% 14%))`,
        color: `hsl(${hue} 70% 82%)`,
      }}
    >
      {initials(name)}
    </span>
  );
}
