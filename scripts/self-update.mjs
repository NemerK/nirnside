import { existsSync, mkdirSync, readdirSync, cpSync, rmSync, renameSync, statSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** GitHub repo ZIP/git updates pull from. Override with NIRNSIDE_UPDATE_REPO. */
export const DEFAULT_REPO = "NemerK/nirnside";
/** Branch ZIP users track. Git clones fetch and stay on origin/main. */
export const DEFAULT_REF = "main";

const RESTART_NAME = ".nirnside-restart";
const REVISION_NAME = ".nirnside-revision";
const EXE_DIGEST_NAME = ".nirnside-exe-digest";
const CHANNEL_NAME = "nirnside-channel.json";

export function shouldSkip(relPath) {
  const n = relPath.replace(/\\/g, "/");
  if (n === "node_modules" || n.startsWith("node_modules/")) return true;
  if (n === ".next" || n.startsWith(".next/")) return true;
  if (n === ".git" || n.startsWith(".git/")) return true;
  if (n === "runtime" || n.startsWith("runtime/")) return true;
  if (/(^|\/)Nirnside\.exe$/i.test(n)) return true;
  if (n === "nirnside-installer.log") return true;
  if (n === REVISION_NAME || n === RESTART_NAME || n === EXE_DIGEST_NAME) return true;
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
  writeFileSync(join(toDir, ".nirnside-need-build"), "1\n");
  return files;
}

export function parseAddonVersion(dir) {
  const txt = join(dir, "addon", "NirnsideSnapshot", "NirnsideSnapshot.txt");
  if (!existsSync(txt)) return null;
  try {
    const m = readFileSync(txt, "utf8").match(/^##\s*Version:\s*(.+)$/im);
    if (!m) return null;
    return m[1].trim().split(".").map((n) => Number.parseInt(n, 10) || 0);
  } catch {
    return null;
  }
}

function versionLess(a, b) {
  if (!a || !b) return false;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av < bv) return true;
    if (av > bv) return false;
  }
  return false;
}

/**
 * Refuse to overlay GitHub main onto a newer local copy (e.g. this PR zip
 * before main has caught up). Overlay does not delete extra files, but it
 * *would* overwrite addon Lua and start scripts with the older tree.
 *
 * CAREFUL: this check reads the Snapshot addon's version. A main-side
 * version regression (restoring an old addon file without re-bumping the
 * version) makes every install that carried the higher version silently
 * refuse ALL updates. If you restore an old addon file, bump its Version
 * above every version ever shipped.
 */
export function wouldDowngrade(fromDir, toDir) {
  const incomingHasUpdater = existsSync(join(fromDir, "scripts", "self-update.mjs"));
  const localHasUpdater = existsSync(join(toDir, "scripts", "self-update.mjs"));
  if (localHasUpdater && !incomingHasUpdater) {
    return "GitHub copy is older (no self-updater). Not replacing this install. Merge to main, then start again.";
  }
  const incomingVer = parseAddonVersion(fromDir);
  const localVer = parseAddonVersion(toDir);
  if (versionLess(incomingVer, localVer)) {
    return `GitHub addon is older (${(incomingVer || []).join(".")} < ${(localVer || []).join(".")}). Not replacing this install.`;
  }
  return null;
}

export function readChannel(root) {
  const p = join(root, CHANNEL_NAME);
  const fallback = { repo: DEFAULT_REPO, ref: DEFAULT_REF };
  if (!existsSync(p)) return fallback;
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8"));
    return {
      repo: typeof parsed.repo === "string" && parsed.repo ? parsed.repo : fallback.repo,
      ref: typeof parsed.ref === "string" && parsed.ref ? parsed.ref : fallback.ref,
    };
  } catch {
    return fallback;
  }
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

/**
 * Keep the Nirnside.exe binary itself fresh, the same as the app code.
 * The exe in an install is never touched by code updates (an update may even
 * run while it is starting), so launcher-side fixes (icons, launch flow)
 * would otherwise require a manual redownload — the one thing this app
 * promises never to need.
 *
 * The published exe is fetched from the GitHub release, verified against the
 * release API's sha256 digest before it is trusted, then swapped in with a
 * rename (a running exe can be renamed but not overwritten on Windows). The
 * running process is unaffected; the new exe takes effect next launch.
 */
export async function maybeUpdateExe(root, repo, apiBase = "https://api.github.com") {
  const exePath = join(root, "Nirnside.exe");
  if (!existsSync(exePath)) return;
  try {
    const release = await githubJson(`${apiBase}/repos/${repo}/releases/latest`);
    const asset = (release.assets ?? []).find((a) => a && a.name === "Nirnside.exe");
    const digest = String(asset?.digest ?? "").replace(/^sha256:/, "").toLowerCase();
    if (!asset || !digest || !asset.browser_download_url) return;
    let stored = "";
    try {
      stored = readFileSync(join(root, EXE_DIGEST_NAME), "utf8").trim().toLowerCase();
    } catch {
      /* first run */
    }
    if (stored === digest) return;

    log("A newer Nirnside.exe is available — downloading it once…");
    const tmpPath = `${exePath}.new`;
    await download(asset.browser_download_url, tmpPath);
    const got = createHash("sha256").update(readFileSync(tmpPath)).digest("hex");
    if (got !== digest) {
      rmSync(tmpPath, { force: true });
      log("The downloaded Nirnside.exe failed its checksum — keeping the current one.");
      return;
    }
    const oldPath = `${exePath}.old`;
    try {
      rmSync(oldPath, { force: true });
    } catch {
      /* a previous leftover may be locked; rename below will still try */
    }
    renameSync(exePath, oldPath);
    try {
      renameSync(tmpPath, exePath);
    } catch (err) {
      // Put the old one back so the app still launches.
      if (!existsSync(exePath)) renameSync(oldPath, exePath);
      throw err;
    }
    writeFileSync(join(root, EXE_DIGEST_NAME), `${digest}\n`);
    try {
      rmSync(oldPath, { force: true });
    } catch {
      /* Windows may hold it a moment; the next swap cleans it up */
    }
    log("Nirnside.exe updated — the new one starts on the next launch.");
  } catch (err) {
    log(`Nirnside.exe check skipped: ${err instanceof Error ? err.message : err}`);
  }
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
  log("Git clone detected — updating from origin/main (live channel).");
  const before = git(root, ["rev-parse", "HEAD"]).stdout.trim();
  const fetch = git(root, ["fetch", "--quiet", "origin", "main"]);
  if (fetch.status !== 0) {
    log(`git fetch failed: ${(fetch.stderr || fetch.stdout || "").trim() || "unknown error"}`);
    return 0;
  }
  const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]).stdout.trim() || DEFAULT_REF;
  if (branch !== "main") {
    log(`This copy was on ${branch}; switching to main so the hub stays live.`);
    let co = git(root, ["checkout", "-B", "main", "origin/main"]);
    if (co.status !== 0) {
      // Installs are never hand-edited: restore tracked files and retry once
      // so file churn can't strand a machine on an old version.
      git(root, ["checkout", "--", "."]);
      co = git(root, ["checkout", "-B", "main", "origin/main"]);
    }
    if (co.status !== 0) {
      log(`checkout main failed (local changes were not overwritten): ${(co.stderr || "").trim()}`);
      return 0;
    }
  } else {
    let pull = git(root, ["pull", "--ff-only", "origin", "main"]);
    if (pull.status !== 0) {
      // An install is never intentionally edited — tracked-file churn from npm
      // or tools must not block updates. Restore everything and try once more.
      git(root, ["checkout", "--", "."]);
      pull = git(root, ["pull", "--ff-only", "origin", "main"]);
    }
    if (pull.status !== 0) {
      log(`git pull failed (your local changes were not overwritten): ${(pull.stderr || "").trim()}`);
      return 0;
    }
  }
  const after = git(root, ["rev-parse", "HEAD"]).stdout.trim();
  writeRevision(root, {
    source: "git",
    repo: DEFAULT_REPO,
    ref: "main",
    sha: after,
    at: new Date().toISOString(),
  });
  if (before && after && before !== after) {
    log(`Updated ${before.slice(0, 7)} → ${after.slice(0, 7)}.`);
    // The launcher only rebuilds when this marker exists. Without it, a git
    // pull fetched new code but kept serving the stale .next build.
    writeFileSync(join(root, ".nirnside-need-build"), "1\n");
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
  const downgrade = wouldDowngrade(from, root);
  if (downgrade) {
    log(downgrade);
    try {
      rmSync(zipPath, { force: true });
      rmSync(extractDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    return 0;
  }
  const files = overlayCopy(from, root);
  const addonLua = existsSync(join(root, "addon", "NirnsideSnapshot", "NirnsideSnapshot.lua"));
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
  log(
    `Applied ${files} files from ${sha.slice(0, 7)} (app + addon source). Your data folder was left alone.` +
      (addonLua ? " Next: copy those addons into ESO AddOns." : ""),
  );
  markRestart(root);
  return 2;
}

export async function runSelfUpdate(root = process.cwd()) {
  if (process.env.NIRNSIDE_SKIP_UPDATE === "1" || process.env.CI) {
    log("Skipped (NIRNSIDE_SKIP_UPDATE or CI).");
    return 0;
  }
  const channel = readChannel(root);
  const repo = process.env.NIRNSIDE_UPDATE_REPO || channel.repo;
  const ref = process.env.NIRNSIDE_UPDATE_REF || channel.ref;
  try {
    let code;
    if (isGitClone(root)) code = await updateFromGit(root);
    else code = await updateFromZip(root, repo, ref);
    // Best effort and never fatal: keep the launcher binary fresh too.
    await maybeUpdateExe(root, repo);
    return code;
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
