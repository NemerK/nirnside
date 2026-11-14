import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { bootedAt } from "./boot";
import { readLocalSha } from "./revision";
import { getUpdateInfo } from "./update-info";
import { isUpdateAvailable, launcherOrigin } from "./update-status";

export interface UpdateStatus {
  currentSha: string | null;
  remoteSha: string | null;
  available: boolean;
  skipped: boolean;
  repo: string;
  ref: string;
  /** Short label for the banner. Empty when nothing is waiting. */
  label: string;
  /** Launcher HTTP origin, when Nirnside.exe started this process. */
  launcherUrl: string | null;
  bootedAt: number;
}

const CACHE_MS = 60_000;
let cache: { at: number; status: UpdateStatus } | null = null;

function gitLine(root: string, args: string[]): string | null {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    timeout: 8000,
    windowsHide: true,
  });
  if (result.status !== 0) return null;
  const line = result.stdout.trim().split(/\r?\n/)[0]?.trim() || "";
  return line || null;
}

async function githubSha(repo: string, ref: string): Promise<string | null> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(ref)}`, {
      headers: {
        "User-Agent": "nirnside-self-update",
        Accept: "application/vnd.github+json",
      },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { sha?: string };
    const sha = body.sha?.trim() || "";
    return sha || null;
  } catch {
    return null;
  }
}

/**
 * Compare this install with the commit the next launch would apply.
 * Git clones track origin/main (what self-update pulls). Zip installs track
 * the GitHub channel. Failures read as "no update", same as the launcher.
 */
export async function getUpdateStatus(root = process.cwd(), now = Date.now()): Promise<UpdateStatus> {
  if (cache && now - cache.at < CACHE_MS && cache.status.bootedAt === bootedAt) {
    return cache.status;
  }
  const info = getUpdateInfo();
  let current = info.sha ?? readLocalSha(root);
  let remote: string | null = null;
  let ref = info.ref;

  if (!info.skipped && existsSync(join(root, ".git"))) {
    current = gitLine(root, ["rev-parse", "HEAD"]) ?? current;
    const remoteLine = gitLine(root, ["ls-remote", "origin", "refs/heads/main"]);
    remote = remoteLine?.split(/\s+/)[0] || null;
    ref = "main";
  } else if (!info.skipped) {
    ref = info.ref && info.ref !== "this git branch" ? info.ref : "main";
    remote = await githubSha(info.repo, ref);
  }

  const available = isUpdateAvailable(current, remote, info.skipped);
  const status: UpdateStatus = {
    currentSha: current,
    remoteSha: remote,
    available,
    skipped: info.skipped,
    repo: info.repo,
    ref,
    label: available && remote ? remote.slice(0, 7) : "",
    launcherUrl: launcherOrigin(process.env.NIRNSIDE_LAUNCHER_URL),
    bootedAt,
  };
  cache = { at: now, status };
  return status;
}
