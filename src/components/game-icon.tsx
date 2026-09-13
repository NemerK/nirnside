/**
 * Legal image handling. We never bundle copyrighted ESO art. If an icon path is
 * known (from an in-game scan) and an icon CDN base is configured via
 * NEXT_PUBLIC_NIRNSIDE_ICON_BASE, we render from there; otherwise we draw a
 * tasteful, deterministic placeholder from the entry's initials + accent color.
 */
const ICON_BASE = process.env.NEXT_PUBLIC_NIRNSIDE_ICON_BASE;

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
  if (icon && ICON_BASE) {
    const src = icon.startsWith("http") ? icon : `${ICON_BASE.replace(/\/$/, "")}/${icon.replace(/^\//, "")}`;
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`rounded-md border border-border object-cover ${className}`}
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
