import { NextResponse } from "next/server";
import { applyUploadedLua, applyUserPath, rescanNow, resetSetupPath } from "@/lib/snapshot/auto";
import { getSetupStatus } from "@/lib/setup/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getSetupStatus());
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file uploaded." }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const result = applyUploadedLua(file.name, buf);
    if (!result.ok) return NextResponse.json({ ...result, status: getSetupStatus() }, { status: 400 });
    return NextResponse.json({ ok: true, status: getSetupStatus() });
  }

  let body: { path?: string; action?: string } = {};
  try {
    body = (await req.json()) as { path?: string; action?: string };
  } catch {
    body = {};
  }

  if (body.action === "rescan") {
    rescanNow("manual-rescan");
    return NextResponse.json({ ok: true, status: getSetupStatus() });
  }

  if (body.action === "reset") {
    resetSetupPath();
    return NextResponse.json({ ok: true, status: getSetupStatus() });
  }

  if (body.path) {
    const result = applyUserPath(body.path);
    if (!result.ok) {
      return NextResponse.json({ ...result, status: getSetupStatus() }, { status: 400 });
    }
    return NextResponse.json({ ok: true, status: getSetupStatus() });
  }

  return NextResponse.json({ ok: false, error: "Nothing to do." }, { status: 400 });
}
