import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AtlasSection } from "@/components/atlas/section";
import { GalleryBoard } from "@/components/gallery-board";
import { LookSwitch } from "@/components/look-switch";
import { PageFrame, PageHeader, PageScroll } from "@/components/ui";
import type { GalleryPhoto } from "@/lib/db/gallery";
import type { GallerySubject } from "@/lib/gallery/subject";

export function GalleryView({ subject, photos }: { subject: GallerySubject; photos: GalleryPhoto[] }) {
  const board = <GalleryBoard kind={subject.kind} ownerId={subject.id} photos={photos} />;
  const back = (
    <Link
      href={subject.backHref}
      className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
    >
      <ArrowLeft className="h-4 w-4" /> {subject.backLabel}
    </Link>
  );
  const subtitle = `${subject.detail}. Photos stay on this computer and are not part of a snapshot.`;

  return (
    <LookSwitch
      classic={
        <PageFrame>
          <PageScroll>
            {back}
            <PageHeader title={subject.title} subtitle={subtitle} />
            {board}
          </PageScroll>
        </PageFrame>
      }
      atlas={
        <AtlasSection title={subject.title} subtitle={subtitle}>
          {back}
          {board}
        </AtlasSection>
      }
    />
  );
}
