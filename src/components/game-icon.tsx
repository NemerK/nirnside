"use client";

import { useState } from "react";
import { iconImageUrls } from "@/lib/icons/sources";

/**
 * Icon rendering. ESO exposes icons as in-game .dds texture paths (e.g.
 * "/esoui/art/icons/ability_mageguild_meteor.dds"). We never extract or bundle
 * the game's art. Instead every icon is served by our own local proxy route
 * (`/api/icon`), which fetches the PNG from a public mirror, caches it to disk,
 * and serves it back. Because the fetch happens on the user's own machine with
 * proper headers, it avoids the browser hotlink failures we used to see, and
 * once cached everything is instant and works offline.
 *
 * If no icon path is known, or the proxy can't source the image, we fall back
 * to a tasteful deterministic placeholder from the entry's initials.
 */
function resolveIconUrls(icon: string): string[] {
  if (!icon) return [];
  if (/^https?:\/\//i.test(icon)) return [icon];
  return iconImageUrls(icon);
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
  const urls = icon ? resolveIconUrls(icon) : [];
  const [attempt, setAttempt] = useState(0);
  const [forIcon, setForIcon] = useState(icon);
  if (icon !== forIcon) {
    setForIcon(icon);
    setAttempt(0);
  }
  const src = icon === forIcon ? urls[attempt] : urls[0];

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={src}
        src={src}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        onError={() => setAttempt((n) => n + 1)}
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
