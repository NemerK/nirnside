import { NextResponse } from "next/server";
import { nativePick, nativePickerAvailable, type PickMode } from "@/lib/setup/native-pick";
import { applyUserPath } from "@/lib/snapshot/auto";
import { getSetupStatus } from "@/lib/setup/status";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The native dialog opens on the machine *running* Nirnside. If the page is
 * being viewed from a different device (a remote/cloud host), that dialog is
 * invisible to the user and would just hang, so we only offer it when the
 * request comes from this same machine.
 */
function requestIsLocal(req: Request): boolean {
  const host = (req.headers.get("host") ?? "").split(":")[0].trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]" || host === "";
}

/** Whether this machine can show a native OS file/folder dialog to this viewer. */
export async function GET(req: Request) {
  return NextResponse.json({ available: nativePickerAvailable() && requestIsLocal(req) });
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

  if (!requestIsLocal(req)) {
    return NextResponse.json(
      {
        ok: false,
        unavailable: true,
        error:
          "The file window opens on the computer running Nirnside, which isn't this device. Paste the path or upload your NirnsideSnapshot.lua instead.",
      },
      { status: 501 },
    );
  }

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
