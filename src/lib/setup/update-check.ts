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
const FAILED_CACHE_MS = 5_000;
let cache: { at: number; ttl: number; status: UpdateStatus } | null = null;

/** Last successful head for a channel, plus the feed validator, so a later check can be a 304. */
const remoteMemory = new Map<string, { etag: string | null; sha: string | null }>();

/** First commit in GitHub's public commit feed. The REST API is not used: an open window would spend its hourly allowance. */
export function shaFromCommitFeed(body: string): string | null {
  const grit = body.match(/Grit::Commit\/([0-9a-f]{40})/i);
  if (grit?.[1]) return grit[1];
  const json = body.match(/"sha"\s*:\s*"([0-9a-f]{7,40})"/i);
  return json?.[1] ?? null;
}

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

function channelOk(repo: string, ref: string): boolean {
  return /^[\w.-]+\/[\w.-]+$/.test(repo) && /^[\w.-]+$/.test(ref);
}

/**
 * The commit a zip install would apply. Uses GitHub's public commit feed, with
 * If-None-Match, because api.github.com allows 60 unauthenticated requests an
 * hour and this window asks more often than that. A refusal used to look like
 * "no update" until the process was restarted.
 */
async function remoteHead(repo: string, ref: string): Promise<string | null> {
  if (!channelOk(repo, ref)) return null;
  const key = `${repo}@${ref}`;
  const memory = remoteMemory.get(key) ?? { etag: null, sha: null };
  try {
    const headers: Record<string, string> = {
      "User-Agent": "nirnside-self-update",
      Accept: "application/atom+xml",
    };
    if (memory.etag) headers["If-None-Match"] = memory.etag;
    const res = await fetch(`https://github.com/${repo}/commits/${encodeURIComponent(ref)}.atom`, {
      headers,
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (res.status === 304) return memory.sha;
    if (!res.ok) return memory.sha;
    const sha = shaFromCommitFeed(await res.text());
    if (!sha) return memory.sha;
    remoteMemory.set(key, { etag: res.headers.get("etag"), sha });
    return sha;
  } catch {
    return memory.sha;
  }
}

/**
 * The Windows app runs a ready-built copy, so "an update is waiting" means a
 * newer ready-built release is published, not just a newer commit (the
 * release is built a few minutes after each commit lands).
 */
async function releasedBundleSha(repo: string): Promise<string | null> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  const key = `${repo}#bundle`;
  const memory = remoteMemory.get(key) ?? { etag: null, sha: null };
  try {
    const res = await fetch(`https://github.com/${repo}/releases/download/latest/nirnside-win-x64.json`, {
      headers: { "User-Agent": "nirnside-self-update" },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) return memory.sha;
    const sha = ((await res.json()) as { sha?: unknown }).sha;
    if (typeof sha !== "string" || !/^[0-9a-f]{7,40}$/i.test(sha)) return memory.sha;
    remoteMemory.set(key, { etag: null, sha });
    return sha;
  } catch {
    return memory.sha;
  }
}

/**
 * Compare this install with the commit the next launch would apply.
 * Git clones ask origin/main. Zip installs, and a git install whose git
 * command failed, read the public commit feed. A feed that cannot be reached
 * keeps the last head it saw, so a blip does not hide an update already found.
 */
export async function getUpdateStatus(
  root = process.cwd(),
  now = Date.now(),
  options?: { fresh?: boolean },
): Promise<UpdateStatus> {
  if (!options?.fresh && cache && now - cache.at < cache.ttl && cache.status.bootedAt === bootedAt) {
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
  }
  if (!remote && !info.skipped && process.env.NIRNSIDE_INSTALL_ROOT) {
    remote = await releasedBundleSha(info.repo);
  } else if (!remote && !info.skipped) {
    remote = await remoteHead(info.repo, ref);
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
  cache = { at: now, ttl: remote ? CACHE_MS : FAILED_CACHE_MS, status };
  return status;
}
