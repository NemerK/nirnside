import { NextResponse } from "next/server";
import { createGearBuild, listGearBuilds } from "@/lib/db/gear-builds";
import type { SavedBuild } from "@/lib/builds/saved";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ builds: listGearBuilds() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load builds." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let body: Partial<SavedBuild> = {};
  try {
    body = (await req.json()) as Partial<SavedBuild>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  try {
    const build = createGearBuild({ ...body, name: body.name ?? "" });
    return NextResponse.json({ build, builds: listGearBuilds() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save the build." }, { status: 400 });
  }
}
