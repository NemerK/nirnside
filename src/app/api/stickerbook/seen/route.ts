import { NextResponse } from "next/server";
import { getAccount } from "@/lib/db/queries";
import { markStickerbookPiecesSeen } from "@/lib/stickerbook/seen-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Remember that the player hovered a newly collected stickerbook piece. */
export async function POST(req: Request) {
  let body: { keys?: unknown } = {};
  try {
    body = (await req.json()) as { keys?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === "string" && k.length > 0) : [];
  try {
    const account = getAccount()?.displayName ?? "";
    markStickerbookPiecesSeen(account, keys);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not mark seen." }, { status: 500 });
  }
}
