import { NextResponse } from "next/server";
import { appendFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { join } from "node:path";
import { parentIsLauncher } from "@/lib/setup/launcher-parent";
import { launcherApplyUrl } from "@/lib/setup/update-status";
import { getUpdateStatus } from "@/lib/setup/update-check";
import {
  classifyLauncherResponse,
  launcherCandidates,
  outsideJobCommand,
  planUpdate,
} from "@/lib/setup/update-handoff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HANDOFF_FAILED =
  "Could not start the update. Start Nirnside from the shortcut once, then try Update again.";

/** POST one launcher. Null when that port is not the in-window updater. */
async function tryLauncher(url: string): Promise<Response | null> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(8000) });
  } catch {
    return null;
  }
  const body = await res.text();
  if (classifyLauncherResponse(res.status, body) === "miss") return null;
  return new NextResponse(body || "{}", {
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

/**
 * Older Nirnside.exe owns this process. A child of the server dies with that
 * exe, so WMI starts the helper outside the job. The exe then treats our exit
 * as Stop and closes; the browser window stays and reloads when the helper
 * brings the server back.
 */
function restartOutsideJob(): boolean {
  const root = process.cwd();
  const cmd = outsideJobCommand({
    node: process.execPath,
    script: join(root, "scripts", "apply-update.mjs"),
    root,
    pid: process.pid,
    dev: process.env.NODE_ENV === "development",
  });
  const result = spawnSync(cmd.file, cmd.args, {
    windowsHide: true,
    encoding: "utf8",
    timeout: 20_000,
  });
  if (result.status === 0) {
    setTimeout(() => process.exit(0), 600);
    return true;
  }
  const detail = (result.stderr || result.stdout || result.error?.message || "powershell failed").trim();
  try {
    appendFileSync(join(root, "nirnside-installer.log"), `[nirnside-update] Could not start the updater outside the launcher. ${detail}\n`);
  } catch {
    /* the restart log is best-effort */
  }
  return false;
}

export async function GET() {
  return NextResponse.json(await getUpdateStatus());
}

export async function POST() {
  const status = await getUpdateStatus();
  if (status.skipped) {
    return NextResponse.json({ error: "Updates are turned off on this copy." }, { status: 400 });
  }

  for (const url of launcherCandidates(launcherApplyUrl(process.env.NIRNSIDE_LAUNCHER_URL))) {
    const answer = await tryLauncher(url);
    if (answer) return answer;
  }

  const plan = planUpdate({
    platform: process.platform,
    parentIsLauncher: parentIsLauncher(),
  });
  if (plan === "outside-job") {
    if (!restartOutsideJob()) {
      return NextResponse.json({ error: HANDOFF_FAILED }, { status: 503 });
    }
  } else {
    restartWithoutLauncher();
  }
  return NextResponse.json({ ok: true, restarting: true });
}
