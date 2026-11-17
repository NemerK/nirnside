import Link from "next/link";
import { Images } from "lucide-react";

export function GalleryLink({ href, count }: { href: string; count?: number }) {
  const n = count ?? 0;
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-accent">
      <Images className="h-3.5 w-3.5" />
      {n > 0 ? `Gallery · ${n}` : "Gallery"}
    </Link>
  );
}
