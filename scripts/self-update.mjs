import { existsSync, mkdirSync, readdirSync, cpSync, rmSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** GitHub repo ZIP/git updates pull from. Override with NIRNSIDE_UPDATE_REPO. */
export const DEFAULT_REPO = "NemerK/nirnside";
/** Branch ZIP users track. Git clones follow whatever branch they checked out. */
export const DEFAULT_REF = "main";

const RESTART_NAME = ".nirnside-restart";
const REVISION_NAME = ".nirnside-revision";

export function shouldSkip(relPath) {
  const n = relPath.replace(/\\/g, "/");
  if (n === "node_modules" || n.startsWith("node_modules/")) return true;
  if (n === ".next" || n.startsWith(".next/")) return true;
  if (n === ".git" || n.startsWith(".git/")) return true;
  if (n === REVISION_NAME || n === RESTART_NAME) return true;
  if (n === ".env" || n.startsWith(".env.")) return true;
  if (/(^|\/)[^/]+\.db(-wal|-shm)?$/i.test(n)) return true;
  if (/^data\/incoming\/.+\.lua$/i.test(n)) return true;
  return false;
}

/**
 * Copy an unpacked Nirnside tree over an existing install without touching the
 * local account database or dropped SavedVariables files.
 */
export function overlayCopy(fromDir, toDir) {
  let files = 0;
  function walk(dir) {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, ent.name);
      const rel = relative(fromDir, full);
      if (shouldSkip(rel)) continue;
      if (ent.isSymbolicLink()) continue;
      if (ent.isDirectory()) {
        walk(full);
        continue;
      }
      if (!ent.isFile()) continue;
      const dest = join(toDir, rel);
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(full, dest);
      files += 1;
    }
  }
  walk(fromDir);
  return files;
}

export function revisionPath(root) {
  return join(root, REVISION_NAME);
}

export function readRevision(root) {
  const p = revisionPath(root);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

export function writeRevision(root, info) {
  writeFileSync(revisionPath(root), JSON.stringify(info, null, 2) + "\n");
}

function log(msg) {
  console.log(`[nirnside-update] ${msg}`);
}

function git(root, args) {
  return spawnSync("git", args, { cwd: root, encoding: "utf8" });
}

function isGitClone(root) {
  return existsSync(join(root, ".git")) && git(root, ["rev-parse", "--is-inside-work-tree"]).status === 0;
}

async function githubJson(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "nirnside-self-update",
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub ${res.status} for ${url}`);
  }
  return res.json();
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": "nirnside-self-update" }, redirect: "follow" });
  if (!res.ok) throw new Error(`Download ${res.status} for ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function extractZip(zipPath, dest) {
  mkdirSync(dest, { recursive: true });
  let r = spawnSync("tar", ["-xf", zipPath, "-C", dest], { encoding: "utf8" });
  if (r.status === 0) return;
  if (process.platform === "win32") {
    r = spawnSync(
      "powershell",
      ["-NoProfile", "-Command", `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`],
      { encoding: "utf8" },
    );
  } else {
    r = spawnSync("unzip", ["-q", "-o", zipPath, "-d", dest], { encoding: "utf8" });
  }
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || "Could not unzip the update.").trim());
  }
}

function extractedRoot(dest) {
  const entries = readdirSync(dest).filter((n) => !n.startsWith("."));
  if (entries.length === 1 && statSync(join(dest, entries[0])).isDirectory()) {
    return join(dest, entries[0]);
  }
  return dest;
}

function markRestart(root) {
  writeFileSync(join(root, RESTART_NAME), "1\n");
}

async function updateFromGit(root) {
  log("Git clone detected — pulling the latest commit on this branch.");
  const before = git(root, ["rev-parse", "HEAD"]).stdout.trim();
  const fetch = git(root, ["fetch", "--quiet"]);
  if (fetch.status !== 0) {
    log(`git fetch failed: ${(fetch.stderr || fetch.stdout || "").trim() || "unknown error"}`);
    return 0;
  }
  const pull = git(root, ["pull", "--ff-only"]);
  if (pull.status !== 0) {
    log(`git pull failed (your local changes were not overwritten): ${(pull.stderr || "").trim()}`);
    return 0;
  }
  const after = git(root, ["rev-parse", "HEAD"]).stdout.trim();
  const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim() || DEFAULT_REF;
  writeRevision(root, {
    source: "git",
    repo: DEFAULT_REPO,
    ref: branch,
    sha: after,
    at: new Date().toISOString(),
  });
  if (before && after && before !== after) {
    log(`Updated ${before.slice(0, 7)} → ${after.slice(0, 7)}.`);
    markRestart(root);
    return 2;
  }
  log("Already up to date.");
  return 0;
}

async function updateFromZip(root, repo, ref) {
  log(`Checking GitHub ${repo}@${ref}…`);
  const commit = await githubJson(`https://api.github.com/repos/${repo}/commits/${encodeURIComponent(ref)}`);
  const sha = commit.sha;
  const prev = readRevision(root);
  if (prev?.sha === sha) {
    log(`Already up to date (${sha.slice(0, 7)}).`);
    return 0;
  }

  const zipPath = join(tmpdir(), `nirnside-${sha.slice(0, 12)}.zip`);
  const extractDir = join(tmpdir(), `nirnside-${sha.slice(0, 12)}`);
  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });

  log("Downloading latest zip…");
  await download(`https://codeload.github.com/${repo}/zip/${sha}`, zipPath);
  extractZip(zipPath, extractDir);
  const from = extractedRoot(extractDir);
  const files = overlayCopy(from, root);
  writeRevision(root, {
    source: "zip",
    repo,
    ref,
    sha,
    at: new Date().toISOString(),
  });
  try {
    rmSync(zipPath, { force: true });
    rmSync(extractDir, { recursive: true, force: true });
  } catch {
    /* temp cleanup is best-effort */
  }
  log(`Applied ${files} files from ${sha.slice(0, 7)}. Your data folder was left alone.`);
  markRestart(root);
  return 2;
}

export async function runSelfUpdate(root = process.cwd()) {
  if (process.env.NIRNSIDE_SKIP_UPDATE === "1" || process.env.CI) {
    log("Skipped (NIRNSIDE_SKIP_UPDATE or CI).");
    return 0;
  }
  const repo = process.env.NIRNSIDE_UPDATE_REPO || DEFAULT_REPO;
  const ref = process.env.NIRNSIDE_UPDATE_REF || DEFAULT_REF;
  try {
    if (isGitClone(root)) return await updateFromGit(root);
    return await updateFromZip(root, repo, ref);
  } catch (err) {
    log(`Update failed, starting the copy you already have. ${err instanceof Error ? err.message : err}`);
    return 0;
  }
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? resolve(process.argv[1]) : "";
if (thisFile.toLowerCase() === invoked.toLowerCase()) {
  runSelfUpdate(process.cwd())
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err);
      process.exit(0);
    });
}
