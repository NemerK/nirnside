/**
 * Apply a Nirnside update and start the server again.
 *
 * Used when the app was started from start-nirnside.cmd / .sh, which has no
 * launcher supervising it. The Windows exe path does not use this script: the
 * running launcher stops and restarts its own child. Spawned detached, so it
 * survives the server process exiting.
 */
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runSelfUpdate } from "./self-update.mjs";

export function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err?.code === "EPERM";
  }
}

export function serverArgs(dev) {
  return [dev ? "dev" : "start", "-H", "127.0.0.1", "-p", "43219"];
}

export function npmInstallArgs(root) {
  const win = process.platform === "win32";
  const bundled = win ? join(root, "runtime", "npm.cmd") : join(root, "runtime", "bin", "npm");
  const npm = existsSync(bundled) ? bundled : win ? "npm.cmd" : "npm";
  const args = [npm, "install", "--ignore-scripts", "--no-audit", "--no-fund"];
  if (win) return { cmd: "cmd.exe", args: ["/d", "/s", "/c", ...args] };
  return { cmd: npm, args: args.slice(1) };
}

function log(root, msg) {
  const line = `[nirnside-update] ${msg}\n`;
  try {
    appendFileSync(join(root, "nirnside-installer.log"), line);
  } catch {
    /* the restart log is best-effort */
  }
  console.log(line.trim());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilStopped(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return;
    await sleep(200);
  }
}

function forceStop(pid) {
  if (!isAlive(pid)) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    /* already gone */
  }
}

function runtimeEnv(root, env) {
  const rt = process.platform === "win32" ? join(root, "runtime") : join(root, "runtime", "bin");
  const next = { ...env, NEXT_TELEMETRY_DISABLED: "1", HOSTNAME: "127.0.0.1", npm_config_build_from_source: "false" };
  if (!existsSync(rt)) return next;
  next.PATH = `${rt}${delimiter}${env.PATH || ""}`;
  return next;
}

function defaultRun(root, cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    env: runtimeEnv(root, process.env),
    encoding: "utf8",
    windowsHide: true,
    timeout: 10 * 60 * 1000,
  });
  const out = `${result.stdout || ""}${result.stderr || ""}`.trim();
  if (out) log(root, out.slice(-2000));
  return result.status ?? 1;
}

function defaultStart(root, args) {
  const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, ...args], {
    cwd: root,
    env: runtimeEnv(root, process.env),
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

/**
 * Wait for the old server to exit, apply the update, then start Nirnside again.
 * `run` and `start` are injectable so tests never touch the real install.
 */
export async function applyAndRestart(root, options = {}) {
  const pid = Number(options.pid || 0);
  const dev = Boolean(options.dev);
  const runUpdate = options.runUpdate || (() => runSelfUpdate(root));
  const run = options.run || ((cmd, args) => defaultRun(root, cmd, args));
  const start = options.start || ((args) => defaultStart(root, args));

  if (pid) {
    await waitUntilStopped(pid, 30_000);
    if (isAlive(pid)) {
      forceStop(pid);
      await waitUntilStopped(pid, 8_000);
    }
  }

  log(root, dev ? "Applying update, then restarting the dev server…" : "Applying update, then rebuilding…");
  try {
    await runUpdate();
  } catch (err) {
    log(root, `Update failed, restarting the copy already here. ${err instanceof Error ? err.message : err}`);
  }

  const npm = npmInstallArgs(root);
  const installed = run(npm.cmd, npm.args);
  if (installed !== 0) log(root, "npm install failed. Trying to start the copy already here.");

  if (!dev) {
    const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
    const built = run(process.execPath, [nextBin, "build"]);
    if (built !== 0) log(root, "The build failed. Trying to start whatever was built last.");
  }

  const tsx = join(root, "node_modules", "tsx", "dist", "cli.mjs");
  if (existsSync(tsx)) {
    run(process.execPath, [tsx, join("scripts", "install-addons.ts")]);
  }

  log(root, "Starting Nirnside.");
  start(serverArgs(dev));
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? resolve(process.argv[1]) : "";
if (thisFile.toLowerCase() === invoked.toLowerCase()) {
  const root = process.cwd();
  applyAndRestart(root, {
    pid: Number(process.env.NIRNSIDE_SERVER_PID || 0),
    dev: process.env.NIRNSIDE_RESTART_DEV === "1",
  })
    .then(() => process.exit(0))
    .catch((err) => {
      log(root, err instanceof Error ? err.stack || err.message : String(err));
      process.exit(1);
    });
}
