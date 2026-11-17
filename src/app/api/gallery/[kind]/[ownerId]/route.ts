import { NextResponse } from "next/server";
import { addGalleryPhoto } from "@/lib/db/gallery";
import { gallerySubject } from "@/lib/gallery/subject";
import { GALLERY_MAX_BYTES, GalleryError } from "@/lib/gallery/rules";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ kind: string; ownerId: string }> }) {
  const { kind, ownerId } = await ctx.params;
  const subject = gallerySubject(kind, ownerId);
  if (!subject) return NextResponse.json({ error: "That gallery does not exist." }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read that photo." }, { status: 400 });
  }
  const file = form.get("photo");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a photo." }, { status: 400 });
  if (file.size > GALLERY_MAX_BYTES) {
    return NextResponse.json({ error: "Each photo must be 12 MB or smaller." }, { status: 400 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const photo = addGalleryPhoto(subject.kind, subject.id, bytes);
    return NextResponse.json({ photo });
  } catch (err) {
    const message = err instanceof GalleryError ? err.message : "Could not save that photo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
