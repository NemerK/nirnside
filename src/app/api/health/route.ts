import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Cheap liveness probe for the Windows exe. Must not touch SavedVariables,
 * disk walks, or SQLite — those run after listen and used to freeze the
 * launcher at 98% while `/` scanned every drive letter.
 */
export function GET() {
  return NextResponse.json({ ok: true, app: "nirnside" });
}
