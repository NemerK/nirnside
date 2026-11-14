import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { canRestartWithoutLauncher, parentIsLauncher } from "@/lib/setup/launcher-parent";
import { launcherApplyUrl } from "@/lib/setup/update-status";
import { getUpdateStatus } from "@/lib/setup/update-check";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LAUNCHER_MISSING =
  "Start Nirnside once from the shortcut to finish installing the in-window updater. After that, Update reloads this window on its own.";

/**
 * Ask the running launcher to apply the update. The Windows exe owns the
 * server process; if this process exited on its own, that launcher would
 * treat it as Stop and shut everything down — including a helper we spawned.
 */
async function askLauncher(url: string): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(8000) });
  } catch {
    return NextResponse.json(
      { error: "The launcher did not answer. Start Nirnside from the shortcut, then use Update." },
      { status: 503 },
    );
  }
  if (res.status === 404) {
    return NextResponse.json({ error: LAUNCHER_MISSING }, { status: 409 });
  }
  const text = await res.text();
  return new NextResponse(text || "{}", {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * No launcher (start-nirnside.cmd / .sh): hand the restart to a detached
 * process, answer the browser, then exit so the helper can take the port.
 */
function restartWithoutLauncher(): void {
  const child = spawn(process.execPath, [join(process.cwd(), "scripts", "apply-update.mjs")], {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
    windowsHide: true,
    env: {
      ...process.env,
      NIRNSIDE_SERVER_PID: String(process.pid),
      NIRNSIDE_RESTART_DEV: process.env.NODE_ENV === "development" ? "1" : "0",
    },
  });
  child.unref();
  setTimeout(() => process.exit(0), 600);
}

export async function GET() {
  return NextResponse.json(await getUpdateStatus());
}

export async function POST() {
  const status = await getUpdateStatus();
  if (status.skipped) {
    return NextResponse.json({ error: "Updates are turned off on this copy." }, { status: 400 });
  }
  const launcher = launcherApplyUrl(process.env.NIRNSIDE_LAUNCHER_URL);
  if (launcher) return askLauncher(launcher);
  // An older Nirnside.exe has no apply endpoint and kills whatever it started
  // when that process exits. Don't take the window down with a helper that
  // would die in the same moment.
  if (!canRestartWithoutLauncher(parentIsLauncher())) {
    return NextResponse.json({ error: LAUNCHER_MISSING }, { status: 409 });
  }
  restartWithoutLauncher();
  return NextResponse.json({ ok: true, restarting: true });
}
