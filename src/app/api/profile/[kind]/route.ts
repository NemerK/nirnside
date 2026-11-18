import { NextResponse } from "next/server";
import { clearProfileImage, readProfileImage, setProfileImage, ProfileError } from "@/lib/db/profile";
import { isProfileKind } from "@/lib/profile/media";
import { GALLERY_MAX_BYTES } from "@/lib/gallery/rules";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!isProfileKind(kind)) return NextResponse.json({ error: "That picture is not part of the profile." }, { status: 404 });
  const image = readProfileImage(kind);
  if (!image) return NextResponse.json({ error: "No picture saved." }, { status: 404 });
  return new NextResponse(new Uint8Array(image.bytes), {
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!isProfileKind(kind)) return NextResponse.json({ error: "That picture is not part of the profile." }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Could not read that picture." }, { status: 400 });
  }
  const file = form.get("photo");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a picture." }, { status: 400 });
  if (file.size > GALLERY_MAX_BYTES) {
    return NextResponse.json({ error: "A picture must be 12 MB or smaller." }, { status: 400 });
  }

  try {
    const saved = setProfileImage(kind, new Uint8Array(await file.arrayBuffer()));
    return NextResponse.json({ kind, updatedAt: saved.updatedAt });
  } catch (err) {
    const message = err instanceof ProfileError ? err.message : "Could not save that picture.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  if (!isProfileKind(kind)) return NextResponse.json({ error: "That picture is not part of the profile." }, { status: 404 });
  try {
    clearProfileImage(kind);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof ProfileError ? err.message : "Could not remove that picture.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
