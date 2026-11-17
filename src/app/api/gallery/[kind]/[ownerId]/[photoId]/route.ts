import { NextResponse } from "next/server";
import { deleteGalleryPhoto, readGalleryPhoto } from "@/lib/db/gallery";
import { gallerySubject } from "@/lib/gallery/subject";
import { GalleryError } from "@/lib/gallery/rules";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string; ownerId: string; photoId: string }> }) {
  const { kind, ownerId, photoId } = await ctx.params;
  const subject = gallerySubject(kind, ownerId);
  if (!subject) return NextResponse.json({ error: "That gallery does not exist." }, { status: 404 });
  const photo = readGalleryPhoto(subject.kind, subject.id, photoId);
  if (!photo) return NextResponse.json({ error: "That photo is not in this gallery." }, { status: 404 });
  return new NextResponse(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ kind: string; ownerId: string; photoId: string }> }) {
  const { kind, ownerId, photoId } = await ctx.params;
  const subject = gallerySubject(kind, ownerId);
  if (!subject) return NextResponse.json({ error: "That gallery does not exist." }, { status: 404 });
  try {
    deleteGalleryPhoto(subject.kind, subject.id, photoId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof GalleryError ? err.message : "Could not remove that photo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
