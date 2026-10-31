import { NextResponse } from "next/server";
import { getDisabledModules, setDisabledModules } from "@/lib/modules";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ disabled: getDisabledModules() });
}

export async function POST(req: Request) {
  let body: { disabled?: unknown } = {};
  try {
    body = (await req.json()) as { disabled?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, disabled: setDisabledModules(body.disabled) });
}
