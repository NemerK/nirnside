import { NextResponse } from "next/server";
import { getRosterOrder, setRosterOrder } from "@/lib/roster/order";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ order: getRosterOrder() });
}

export async function POST(req: Request) {
  let body: { order?: unknown } = {};
  try {
    body = (await req.json()) as { order?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, order: setRosterOrder(body.order) });
}
