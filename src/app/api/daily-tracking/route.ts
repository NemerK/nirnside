import { NextResponse } from "next/server";
import { getDailyTracking, updateDailyTracking } from "@/lib/db/daily-tracking";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(getDailyTracking());
  } catch {
    return NextResponse.json({ error: "Could not load your daily tracking." }, { status: 500 });
  }
}

/** Body: { scope: "account", keys } or { scope: "character", characterId, keys }. keys null resets. */
export async function PUT(req: Request) {
  let body: { scope?: unknown; characterId?: unknown; keys?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const keys = body.keys === null ? null : Array.isArray(body.keys) ? (body.keys as string[]) : undefined;
  if (keys === undefined) return NextResponse.json({ error: "Pick which dailies to track." }, { status: 400 });
  try {
    if (body.scope === "account") return NextResponse.json(updateDailyTracking({ scope: "account", keys }));
    if (body.scope === "character" && typeof body.characterId === "string") {
      return NextResponse.json(updateDailyTracking({ scope: "character", characterId: body.characterId, keys }));
    }
    return NextResponse.json({ error: "Say whether this is for the account or one character." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Could not save your daily tracking." }, { status: 500 });
  }
}
