"use client";

import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
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
  bare = false,
  lit = false,
}: {
  name: string;
  icon?: string | null;
  size?: number;
  className?: string;
  /** Skip the framed tile — just the art, for filter rows and similar chrome. */
  bare?: boolean;
  /** Sheen clipped to the icon silhouette — lights the art, not the air around it. */
  lit?: boolean;
}) {
  const urls = icon ? resolveIconUrls(icon) : [];
  const [attempt, setAttempt] = useState(0);
  const [forIcon, setForIcon] = useState(icon);
  if (icon !== forIcon) {
    setForIcon(icon);
    setAttempt(0);
  }
  const src = icon === forIcon ? urls[attempt] : urls[0];
  const [drawn, setDrawn] = useState<string | null>(null);
  const [drawnFor, setDrawnFor] = useState<string | null>(null);
  const display = drawnFor === src ? (drawn ?? src) : src;
  const imgRef = useRef<HTMLImageElement>(null);

  function sharpen(img: HTMLImageElement) {
    if (!src || src.startsWith("data:")) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const target = Math.round(size * dpr);
    // Large slots (the profile crest) need a bitmap that covers the device
    // pixels. Otherwise a small source is stretched and the edges break up.
    if (size < 48 || img.naturalWidth === 0 || img.naturalWidth >= target) return;
    const canvas = document.createElement("canvas");
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, target, target);
    try {
      setDrawnFor(src);
      setDrawn(canvas.toDataURL("image/png"));
    } catch {
      // A cross-origin fallback cannot be read back. Leave the original.
    }
  }

  useEffect(() => {
    const img = imgRef.current;
    // A cached crest can finish loading before hydration attaches onLoad.
    if (img?.complete) sharpen(img);
    // sharpen closes over the current source and size; re-run when those change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, size]);

  if (src && display) {
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={src}
        src={display}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        fetchPriority="low"
        ref={imgRef}
        onError={() => {
          if (display === src) setAttempt((n) => n + 1);
        }}
        onLoad={(event: SyntheticEvent<HTMLImageElement>) => sharpen(event.currentTarget)}
        className={`shrink-0 ${bare ? "object-contain" : "rounded-md border border-border bg-surface-2 object-cover"} ${className}`}
        style={{ width: size, height: size }}
      />
    );
    if (!lit) return img;
    return (
      <span
        className="game-icon-lit"
        style={
          {
            width: size,
            height: size,
            "--icon-mask": `url("${display}")`,
          } as CSSProperties
        }
      >
        {img}
      </span>
    );
  }

  const hue = hueFrom(name);
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center font-semibold ${bare ? "" : "rounded-md border border-border"} ${className}`}
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
