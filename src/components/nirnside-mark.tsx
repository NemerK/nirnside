/**
 * The Nirnside mark: an original nirnroot-inspired glowing leaf sprig, gold on
 * the app's dark tile. Deliberately id-free (no defs/gradients) so it can be
 * mounted several times on one page without collisions.
 */
export function NirnsideMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#141821" />
      <rect width="64" height="64" rx="14" fill="#c8a35a" opacity="0.14" />
      <circle cx="32" cy="46" r="21" fill="#c8a35a" opacity="0.22" />
      <g fill="#c8a35a">
        <path d="M32 8 C40.5 24 40.5 40 32 56 C23.5 40 23.5 24 32 8 Z" />
        <path d="M32 16 C38.5 28 38.5 40 32 56 C25.5 40 25.5 28 32 16 Z" transform="rotate(36 32 56)" />
        <path d="M32 16 C38.5 28 38.5 40 32 56 C25.5 40 25.5 28 32 16 Z" transform="rotate(-36 32 56)" />
      </g>
    </svg>
  );
}
