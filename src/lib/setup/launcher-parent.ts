import { execFileSync } from "node:child_process";

/** tasklist names the Windows launcher `Nirnside.exe`. npm and node do not. */
export function looksLikeLauncherParent(tasklistLine: string): boolean {
  return /nirnside\.exe/i.test(tasklistLine);
}

/**
 * True when the server was started by Nirnside.exe, false when it was not,
 * null when the check itself failed. An old launcher has no in-window update
 * endpoint; exiting the server then would take the helper down with it.
 */
export function parentIsLauncher(): boolean | null {
  if (process.platform !== "win32") return false;
  try {
    const out = execFileSync("tasklist", ["/FI", `PID eq ${process.ppid}`, "/FO", "CSV", "/NH"], {
      encoding: "utf8",
      timeout: 4000,
      windowsHide: true,
    });
    if (!out.trim() || /no tasks are running/i.test(out)) return null;
    return looksLikeLauncherParent(out);
  } catch {
    return null;
  }
}

/** A detached restart is safe except when a Windows launcher may still own this process. */
export function canRestartWithoutLauncher(parent: boolean | null, platform: NodeJS.Platform = process.platform): boolean {
  if (platform !== "win32") return true;
  return parent === false;
}
