"use client";

import { useCallback, useState, type ReactNode } from "react";
import { Images } from "lucide-react";
import { GalleryModal } from "@/components/gallery-modal";
import type { GalleryKind } from "@/lib/gallery/rules";

export function GalleryLink({
  kind,
  ownerId,
  title,
  detail,
  count,
  className = "",
  children,
}: {
  kind: GalleryKind;
  ownerId: string;
  title: string;
  detail: string;
  count?: number;
  /** When set, the whole region opens the gallery. Used for house cards. */
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const n = count ?? 0;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={children ? `Open gallery for ${title}` : undefined}
        className={
          children
            ? `block w-full cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`
            : `inline-flex items-center gap-1 text-xs text-fg-muted hover:text-accent ${className}`
        }
      >
        {children ?? (
          <>
            <Images className="h-3.5 w-3.5" />
            {n > 0 ? `Gallery · ${n}` : "Gallery"}
          </>
        )}
      </button>
      {open ? (
        <GalleryModal kind={kind} ownerId={ownerId} title={title} detail={detail} onClose={close} />
      ) : null}
    </>
  );
}
