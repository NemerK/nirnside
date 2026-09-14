import { NextResponse } from "next/server";
import { loadSampleData, clearAccountData } from "@/lib/snapshot/auto";

export const dynamic = "force-dynamic";

/** Opt-in: load the bundled sample account for a tour of a populated app. */
export async function POST() {
  const ok = loadSampleData();
  return NextResponse.json({ ok });
}

/** Exit the demo: wipe the imported account, back to the honest empty state. */
export async function DELETE() {
  clearAccountData();
  return NextResponse.json({ ok: true });
}
