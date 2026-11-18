import { NextResponse } from "next/server";
import { deleteGearBuild, listGearBuilds, updateGearBuild } from "@/lib/db/gear-builds";
import type { SavedBuild } from "@/lib/builds/saved";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let body: Partial<SavedBuild> = {};
  try {
    body = (await req.json()) as Partial<SavedBuild>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  try {
    const build = updateGearBuild(id, body);
    return NextResponse.json({ build, builds: listGearBuilds() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not update the build." }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    deleteGearBuild(id);
    return NextResponse.json({ ok: true, builds: listGearBuilds() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not delete the build." }, { status: 400 });
  }
}
