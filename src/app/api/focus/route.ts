import { NextResponse } from "next/server";
import { setFocusAreas, setFocusChar } from "@/lib/focus/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { characterId?: string; areas?: unknown; char?: string | null } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  try {
    if (typeof body.characterId === "string" && body.characterId) {
      const areas = setFocusAreas(body.characterId, body.areas);
      return NextResponse.json({ ok: true, areas });
    }
    if (body.char !== undefined) {
      setFocusChar(typeof body.char === "string" ? body.char : null);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save focus." },
      { status: 500 },
    );
  }
}
