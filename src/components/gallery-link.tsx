"use client";

import { useCallback, useState } from "react";
import { Images } from "lucide-react";
import { GalleryModal } from "@/components/gallery-modal";
import type { GalleryKind } from "@/lib/gallery/rules";

export function GalleryLink({
  kind,
  ownerId,
  title,
  detail,
  count,
}: {
  kind: GalleryKind;
  ownerId: string;
  title: string;
  detail: string;
  count?: number;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const n = count ?? 0;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-fg-muted hover:text-accent"
      >
        <Images className="h-3.5 w-3.5" />
        {n > 0 ? `Gallery · ${n}` : "Gallery"}
      </button>
      {open ? (
        <GalleryModal
          kind={kind}
          ownerId={ownerId}
          title={title}
          detail={detail}
          onClose={close}
        />
      ) : null}
    </>
  );
}
