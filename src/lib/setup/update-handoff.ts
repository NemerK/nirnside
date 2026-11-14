import { launcherApplyUrl } from "./update-status";

/**
 * Where an in-window Update is handed off.
 *
 * The launcher that started this server is the right owner when it exposes
 * /api/apply-update. An older Nirnside.exe does not. It also puts the server
 * in a Windows job that dies with the exe, so a normal child would be killed
 * the moment the server exits. That case starts the helper with WMI, which
 * is outside the job, then exits so the open window can reload.
 */
export type UpdateHandoff = "outside-job" | "detached";

const LAUNCHER_PROBES = ["http://127.0.0.1:43218", "http://127.0.0.1:43217"];

/** Launcher apply URLs to try, env first, then the ports the exe actually binds. */
export function launcherCandidates(envApplyUrl: string | null): string[] {
  const urls: string[] = [];
  const add = (url: string | null) => {
    if (url && !urls.includes(url)) urls.push(url);
  };
  add(envApplyUrl);
  for (const origin of LAUNCHER_PROBES) add(launcherApplyUrl(origin));
  return urls;
}

/**
 * A real launcher answer is passed back to the window. 404 and anything that
 * is not our apply endpoint means this port is not the updater — keep looking.
 */
export function classifyLauncherResponse(status: number, body: string): "accept" | "miss" {
  if (status === 404) return "miss";
  if (status === 409) return "accept";
  if (status >= 200 && status < 300) {
    if (/"restarting"\s*:\s*true/.test(body) || /"ok"\s*:\s*true/.test(body)) return "accept";
  }
  return "miss";
}

/** Windows + a launcher parent (or an unknown parent) must leave the job. */
export function planUpdate(input: {
  platform: NodeJS.Platform;
  parentIsLauncher: boolean | null;
}): UpdateHandoff {
  if (input.platform === "win32" && input.parentIsLauncher !== false) return "outside-job";
  return "detached";
}

function quoteWindowsArg(value: string): string {
  if (value.length === 0) return '""';
  if (!/[\s"]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function psSingle(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Start apply-update.mjs outside the launcher's kill-on-close job.
 * Win32_Process.Create runs under WmiPrvSE, not as a child of this server.
 */
export function outsideJobCommand(input: {
  node: string;
  script: string;
  root: string;
  pid: number;
  dev: boolean;
}): { file: string; args: string[] } {
  const commandLine = [
    quoteWindowsArg(input.node),
    quoteWindowsArg(input.script),
    "--root",
    quoteWindowsArg(input.root),
    "--pid",
    String(input.pid),
    "--dev",
    input.dev ? "1" : "0",
  ].join(" ");
  const ps = [
    "$created = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{",
    `CommandLine = ${psSingle(commandLine)};`,
    `CurrentDirectory = ${psSingle(input.root)}`,
    "};",
    "if ($created.ReturnValue -ne 0) { Write-Error ('Win32_Process.Create returned ' + $created.ReturnValue); exit 1 }",
  ].join(" ");
  return {
    file: "powershell.exe",
    args: ["-NoProfile", "-NonInteractive", "-Command", ps],
  };
}
