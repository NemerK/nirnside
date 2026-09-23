import { NextResponse } from "next/server";
import { nativePick, nativePickerAvailable, type PickMode } from "@/lib/setup/native-pick";
import { applyUserPath } from "@/lib/snapshot/auto";
import { getSetupStatus } from "@/lib/setup/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Whether this machine can show a native OS file/folder dialog. */
export async function GET() {
  return NextResponse.json({ available: nativePickerAvailable() });
}

/**
 * Open the OS-native file/folder picker on the user's machine, then apply the
 * chosen path exactly like a typed/browsed one. Runs only locally (nodejs
 * runtime) — the dialog appears on the same desktop as the browser.
 */
export async function POST(req: Request) {
  let body: { mode?: PickMode; startDir?: string } = {};
  try {
    body = (await req.json()) as { mode?: PickMode; startDir?: string };
  } catch {
    body = {};
  }
  const mode: PickMode = body.mode === "folder" ? "folder" : "file";

  const picked = await nativePick(mode, body.startDir);
  if (!picked.ok || !picked.path) {
    // A plain cancel is not an error the user needs to see loudly.
    return NextResponse.json(
      { ok: false, cancelled: !picked.error || picked.error === "No selection.", unavailable: picked.unavailable, error: picked.error },
      { status: picked.unavailable ? 501 : 200 },
    );
  }

  const applied = applyUserPath(picked.path);
  if (!applied.ok) {
    return NextResponse.json({ ok: false, path: picked.path, error: applied.error, status: getSetupStatus() }, { status: 400 });
  }
  return NextResponse.json({ ok: true, path: picked.path, status: getSetupStatus() });
}
