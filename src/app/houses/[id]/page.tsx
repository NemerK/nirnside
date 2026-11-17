import { notFound } from "next/navigation";
import { GalleryView } from "@/components/gallery-view";
import { listGalleryPhotos } from "@/lib/db/gallery";
import { houseGallerySubject } from "@/lib/gallery/subject";

export const dynamic = "force-dynamic";

export default async function HouseGalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const subject = houseGallerySubject(decodeURIComponent(id));
  if (!subject) notFound();
  const photos = listGalleryPhotos(subject.kind, subject.id);
  return <GalleryView subject={subject} photos={photos} />;
}
