import type { WardrobeSetup } from "../snapshot/schema";

/**
 * Render one Wizard's Wardrobe setup to a PNG the player can paste to a friend.
 *
 * Drawn on a canvas (no external libraries, so it works offline). Icons are
 * pulled through our own same-origin `/api/icon` proxy only, so the canvas is
 * never tainted by a cross-origin image and `toBlob` / clipboard writes succeed.
 */
export type SetupImageMeta = {
  character: string;
  zone: string;
  page: string;
};

const PALETTE = {
  bg: "#12151c",
  card: "#161b26",
  border: "#2a3240",
  fg: "#e8e3d6",
  muted: "#9aa4b2",
  subtle: "#6b7686",
  accent: "#c8a35a",
};

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

function loadIcon(path: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!path) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    // Same-origin proxy only — keeps the canvas exportable.
    img.src = `/api/icon?p=${encodeURIComponent(path)}`;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawIcon(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  name: string,
  x: number,
  y: number,
  size: number,
) {
  roundRect(ctx, x, y, size, size, 5);
  ctx.save();
  ctx.clip();
  if (img) {
    ctx.drawImage(img, x, y, size, size);
  } else {
    const hue = hueFrom(name);
    ctx.fillStyle = `hsl(${hue} 45% 22%)`;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = `hsl(${hue} 70% 82%)`;
    ctx.font = `600 ${Math.round(size * 0.4)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials(name), x + size / 2, y + size / 2 + 1);
    ctx.textAlign = "left";
  }
  ctx.restore();
  ctx.strokeStyle = PALETTE.border;
  ctx.lineWidth = 1;
  roundRect(ctx, x + 0.5, y + 0.5, size - 1, size - 1, 5);
  ctx.stroke();
}

export async function renderWardrobeSetupPng(setup: WardrobeSetup, meta: SetupImageMeta): Promise<Blob> {
  const gear = setup.gear.filter((g) => g.name || g.slot);
  const bars = setup.bars.filter((b) => b.skills.some((s) => s.name));

  // Preload every icon first so drawing is synchronous and ordered.
  const gearIcons = await Promise.all(gear.map((g) => loadIcon(g.icon)));
  const barIcons = await Promise.all(bars.map((b) => Promise.all(b.skills.filter((s) => s.name).map((s) => loadIcon(s.icon)))));

  const W = 560;
  const pad = 18;
  const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);

  // Measure height.
  let h = pad + 26 /*title*/ + 16 /*subtitle*/ + 12;
  if (gear.length) h += 16 + gear.length * 30 + 8;
  h += bars.length * (16 + 34 + 6);
  if (setup.cp.length) h += 20;
  if (setup.food?.name) h += 20;
  h += 26; // footer

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.scale(dpr, dpr);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Card background.
  ctx.fillStyle = PALETTE.bg;
  ctx.fillRect(0, 0, W, h);
  ctx.fillStyle = PALETTE.card;
  roundRect(ctx, 4, 4, W - 8, h - 8, 12);
  ctx.fill();
  ctx.strokeStyle = PALETTE.border;
  roundRect(ctx, 4.5, 4.5, W - 9, h - 9, 12);
  ctx.stroke();
  ctx.fillStyle = PALETTE.accent;
  roundRect(ctx, 4, 4, W - 8, 4, 12);
  ctx.fill();

  let y = pad + 20;
  ctx.fillStyle = PALETTE.fg;
  ctx.font = "600 18px system-ui, sans-serif";
  ctx.fillText(setup.name || "Unnamed setup", pad, y);
  y += 16;
  ctx.fillStyle = PALETTE.subtle;
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillText(`${meta.zone} · ${meta.page}`, pad, y);
  y += 16;

  const label = (text: string) => {
    ctx.fillStyle = PALETTE.subtle;
    ctx.font = "700 10px system-ui, sans-serif";
    ctx.fillText(text.toUpperCase(), pad, y);
    y += 14;
  };

  if (gear.length) {
    label("Gear");
    gear.forEach((g, i) => {
      drawIcon(ctx, gearIcons[i], g.name || g.slot, pad, y - 4, 22);
      ctx.fillStyle = PALETTE.fg;
      ctx.font = "13px system-ui, sans-serif";
      ctx.fillText(g.name || g.slot, pad + 30, y + 6);
      const meta2 = [g.slot, g.setName, g.trait].filter(Boolean).join(" · ");
      if (meta2) {
        ctx.fillStyle = PALETTE.muted;
        ctx.font = "10px system-ui, sans-serif";
        ctx.fillText(meta2, pad + 30, y + 18);
      }
      y += 30;
    });
    y += 8;
  }

  bars.forEach((b, bi) => {
    label(b.bar === "front" ? "Front bar" : "Back bar");
    const skills = b.skills.filter((s) => s.name);
    let x = pad;
    skills.forEach((s, si) => {
      drawIcon(ctx, barIcons[bi][si], s.name, x, y - 8, 26);
      x += 32;
    });
    y += 26 + 6;
  });

  if (setup.cp.length) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`CP: ${setup.cp.join(", ")}`, pad, y);
    y += 20;
  }
  if (setup.food?.name) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(`Food: ${setup.food.name}`, pad, y);
    y += 20;
  }

  ctx.fillStyle = PALETTE.subtle;
  ctx.font = "10px system-ui, sans-serif";
  ctx.fillText(`Nirnside · Wizard's Wardrobe · ${meta.character}`, pad, h - pad + 4);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}

/** Copy a setup image to the clipboard; returns false if the browser refused. */
export async function copySetupImage(setup: WardrobeSetup, meta: SetupImageMeta): Promise<boolean> {
  const blob = await renderWardrobeSetupPng(setup, meta);
  try {
    const item = new ClipboardItem({ "image/png": blob });
    await navigator.clipboard.write([item]);
    return true;
  } catch {
    return false;
  }
}

/** Filesystem-safe PNG name for a setup, e.g. `nirnside-cloudrest-tank-trash.png`. */
export function setupImageFilename(setup: WardrobeSetup, meta: SetupImageMeta): string {
  const slug = (v: string) =>
    v
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "x";
  return `nirnside-${slug(meta.zone)}-${slug(meta.page)}-${slug(setup.name || "setup")}.png`;
}

/** Download a setup image as a PNG (fallback when the clipboard is unavailable). */
export async function downloadSetupImage(setup: WardrobeSetup, meta: SetupImageMeta, filename?: string): Promise<void> {
  const blob = await renderWardrobeSetupPng(setup, meta);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? setupImageFilename(setup, meta);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
