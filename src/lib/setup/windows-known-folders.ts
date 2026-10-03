import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * Windows' own Documents / OneDrive locations — including the redirected
 * OneDrive Documents folder ESO actually writes to.
 *
 * `os.homedir() + \\Documents` is often empty once OneDrive takes over.
 * [Environment]::GetFolderPath('MyDocuments') is what Explorer uses.
 */

let cached: string[] | null = null;

const SCRIPT = [
  "$ErrorActionPreference = 'SilentlyContinue'",
  "$paths = @()",
  "$paths += [Environment]::GetFolderPath('MyDocuments')",
  "$paths += [Environment]::GetFolderPath('Personal')",
  "foreach ($name in @('OneDrive','OneDriveConsumer','OneDriveCommercial','USERPROFILE')) {",
  "  $v = [Environment]::GetEnvironmentVariable($name, 'Process')",
  "  if (-not $v) { $v = [Environment]::GetEnvironmentVariable($name, 'User') }",
  "  if ($v) { $paths += $v; $paths += (Join-Path $v 'Documents') }",
  "}",
  "$paths | Where-Object { $_ } | Select-Object -Unique",
].join("; ");

function existingDirs(paths: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of paths) {
    const p = raw.trim();
    if (!p || !existsSync(p)) continue;
    const key = p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export function windowsKnownDocumentDirs(): string[] {
  if (process.platform !== "win32") return [];
  if (cached) return cached;

  const fallback = existingDirs([
    process.env.OneDrive ? `${process.env.OneDrive}\\Documents` : "",
    process.env.OneDriveConsumer ? `${process.env.OneDriveConsumer}\\Documents` : "",
    process.env.OneDriveCommercial ? `${process.env.OneDriveCommercial}\\Documents` : "",
    process.env.USERPROFILE ? `${process.env.USERPROFILE}\\Documents` : "",
  ]);

  try {
    const out = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", SCRIPT], {
      timeout: 8000,
      encoding: "utf8",
      windowsHide: true,
    });
    cached = existingDirs(out.split(/\r?\n/));
    if (cached.length === 0) cached = fallback;
  } catch {
    cached = fallback;
  }
  return cached;
}
