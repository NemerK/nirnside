import { NextResponse } from "next/server";
import { loadSampleData, exitDemo } from "@/lib/snapshot/auto";

export const dynamic = "force-dynamic";

/** Opt-in: load the bundled sample account for a tour of a populated app. */
export async function POST() {
  const ok = loadSampleData();
  return NextResponse.json({ ok });
}

/** Exit the demo: reload the live snapshot if one exists. */
export async function DELETE() {
  exitDemo();
  return NextResponse.json({ ok: true });
}
