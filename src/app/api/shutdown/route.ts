import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Stop the local Nirnside server. The launcher exe watches its child: when
 * this process exits, the launcher exits with it, so nothing is left running
 * invisible. Flush the OK first, then exit on the next tick.
 */
export async function POST() {
  setTimeout(() => process.exit(0), 250);
  return NextResponse.json({ ok: true });
}
