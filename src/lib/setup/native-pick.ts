import { execFile } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * Open the operating system's own file/folder picker so the user can point
 * Nirnside at their ESO data by browsing, not by typing a long path.
 *
 * Nirnside runs locally on the same machine as the browser, so the Node server
 * and the desktop share a session — the native dialog appears for the user.
 * If no GUI/dialog tool is available (headless, remote, or a locked-down box),
 * we return { ok:false } and the caller falls back to the in-app browser.
 */

export type PickMode = "file" | "folder";

export interface PickResult {
  ok: boolean;
  path?: string;
  /** True when we could not even show a dialog (so the UI can hide the button). */
  unavailable?: boolean;
  error?: string;
}

const FILE_TITLE = "Select your NirnsideSnapshot.lua (inside SavedVariables)";
const FOLDER_TITLE = "Select your Elder Scrolls Online data folder (or live / liveeu)";

function run(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 10 * 60_000, windowsHide: true, maxBuffer: 1 << 20 }, (err, stdout, stderr) => {
      const code = err && typeof (err as { code?: number }).code === "number" ? (err as { code?: number }).code! : err ? 1 : 0;
      resolve({ code, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
    });
  });
}

function windowsScript(mode: PickMode, startDir?: string): string {
  const start = startDir ? startDir.replace(/'/g, "''") : "";
  if (mode === "folder") {
    return [
      "Add-Type -AssemblyName System.Windows.Forms | Out-Null",
      "$dlg = New-Object System.Windows.Forms.FolderBrowserDialog",
      `$dlg.Description = '${FOLDER_TITLE.replace(/'/g, "''")}'`,
      start ? `$dlg.SelectedPath = '${start}'` : "",
      "$form = New-Object System.Windows.Forms.Form",
      "$form.TopMost = $true; $form.ShowInTaskbar = $false; $null = $form.Handle",
      "if ($dlg.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dlg.SelectedPath) }",
    ]
      .filter(Boolean)
      .join("; ");
  }
  return [
    "Add-Type -AssemblyName System.Windows.Forms | Out-Null",
    "$dlg = New-Object System.Windows.Forms.OpenFileDialog",
    `$dlg.Title = '${FILE_TITLE.replace(/'/g, "''")}'`,
    "$dlg.Filter = 'Nirnside snapshot (NirnsideSnapshot.lua)|NirnsideSnapshot.lua|Lua files (*.lua)|*.lua|All files (*.*)|*.*'",
    "$dlg.CheckFileExists = $true",
    start ? `$dlg.InitialDirectory = '${start}'` : "",
    "$form = New-Object System.Windows.Forms.Form",
    "$form.TopMost = $true; $form.ShowInTaskbar = $false; $null = $form.Handle",
    "if ($dlg.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dlg.FileName) }",
  ]
    .filter(Boolean)
    .join("; ");
}

async function pickWindows(mode: PickMode, startDir?: string): Promise<PickResult> {
  const { stdout } = await run("powershell.exe", ["-NoProfile", "-STA", "-Command", windowsScript(mode, startDir)]);
  const path = stdout.trim();
  if (!path) return { ok: false, error: "No selection." };
  return { ok: true, path };
}

async function pickMac(mode: PickMode): Promise<PickResult> {
  const prompt = mode === "folder" ? FOLDER_TITLE : FILE_TITLE;
  const chooser = mode === "folder" ? "choose folder" : "choose file";
  const script = `try
  POSIX path of (${chooser} with prompt "${prompt.replace(/"/g, '\\"')}")
on error number -128
  return ""
end try`;
  const { stdout } = await run("osascript", ["-e", script]);
  const path = stdout.trim();
  if (!path) return { ok: false, error: "No selection." };
  return { ok: true, path };
}

function hasCmd(cmd: string): boolean {
  // execFile resolves from PATH; a quick existence probe for common absolute
  // locations plus a PATH lookup keeps this cheap and dependency-free.
  if (existsSync(`/usr/bin/${cmd}`) || existsSync(`/usr/local/bin/${cmd}`) || existsSync(`/bin/${cmd}`)) return true;
  return false;
}

async function pickLinux(mode: PickMode, startDir?: string): Promise<PickResult> {
  if (hasCmd("zenity")) {
    const args = ["--file-selection", `--title=${mode === "folder" ? FOLDER_TITLE : FILE_TITLE}`];
    if (mode === "folder") args.push("--directory");
    if (startDir) args.push(`--filename=${startDir.endsWith("/") ? startDir : startDir + "/"}`);
    const { stdout } = await run("zenity", args);
    const path = stdout.trim();
    return path ? { ok: true, path } : { ok: false, error: "No selection." };
  }
  if (hasCmd("kdialog")) {
    const args = mode === "folder" ? ["--getexistingdirectory", startDir ?? "."] : ["--getopenfilename", startDir ?? "."];
    const { stdout } = await run("kdialog", args);
    const path = stdout.trim();
    return path ? { ok: true, path } : { ok: false, error: "No selection." };
  }
  return { ok: false, unavailable: true, error: "No native file dialog (install zenity) — use the in-app browser." };
}

/** True on platforms where we can attempt a native dialog. */
export function nativePickerAvailable(): boolean {
  if (process.platform === "win32" || process.platform === "darwin") return true;
  return hasCmd("zenity") || hasCmd("kdialog");
}

export async function nativePick(mode: PickMode, startDir?: string): Promise<PickResult> {
  try {
    if (process.platform === "win32") return await pickWindows(mode, startDir);
    if (process.platform === "darwin") return await pickMac(mode);
    if (process.platform === "linux") return await pickLinux(mode, startDir);
    return { ok: false, unavailable: true, error: "Native picker not supported on this OS." };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not open a file dialog." };
  }
}
