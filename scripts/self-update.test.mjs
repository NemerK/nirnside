import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { overlayCopy, runSelfUpdate, shouldSkip, wouldDowngrade } from "./self-update.mjs";

describe("self-update overlay", () => {
  it("skips account data and incoming lua", () => {
    assert.equal(shouldSkip("data/nirnside.db"), true);
    assert.equal(shouldSkip("data/nirnside.db-wal"), true);
    assert.equal(shouldSkip("data/incoming/NirnsideSnapshot.lua"), true);
    assert.equal(shouldSkip("data/catalog/sets.json"), false);
    assert.equal(shouldSkip("addon/NirnsideSnapshot/NirnsideSnapshot.lua"), false);
    assert.equal(shouldSkip("node_modules/next/index.js"), true);
    assert.equal(shouldSkip("runtime/node.exe"), true);
    assert.equal(shouldSkip("Nirnside.exe"), true);
    assert.equal(shouldSkip(".npmrc"), false);
  });

  it("copies app files but keeps the local database", () => {
    const from = join(tmpdir(), `nirnside-from-${Date.now()}`);
    const to = join(tmpdir(), `nirnside-to-${Date.now()}`);
    mkdirSync(join(from, "src"), { recursive: true });
    mkdirSync(join(from, "data", "catalog"), { recursive: true });
    mkdirSync(join(from, "data", "incoming"), { recursive: true });
    mkdirSync(join(to, "data", "incoming"), { recursive: true });
    writeFileSync(join(from, "src", "app.txt"), "new");
    mkdirSync(join(from, "addon", "NirnsideSnapshot"), { recursive: true });
    writeFileSync(join(from, "addon", "NirnsideSnapshot", "NirnsideSnapshot.lua"), "-- new addon");
    writeFileSync(join(from, "data", "catalog", "sets.json"), "[]");
    writeFileSync(join(from, "data", "incoming", "NirnsideSnapshot.lua"), "-- upstream lua must not land");
    writeFileSync(join(to, "data", "nirnside.db"), "MY-ACCOUNT");
    writeFileSync(join(to, "data", "incoming", "NirnsideSnapshot.lua"), "-- mine");

    overlayCopy(from, to);

    assert.equal(readFileSync(join(to, "src", "app.txt"), "utf8"), "new");
    assert.equal(readFileSync(join(to, "addon", "NirnsideSnapshot", "NirnsideSnapshot.lua"), "utf8"), "-- new addon");
    assert.equal(readFileSync(join(to, "data", "catalog", "sets.json"), "utf8"), "[]");
    assert.equal(readFileSync(join(to, "data", "nirnside.db"), "utf8"), "MY-ACCOUNT");
    assert.equal(readFileSync(join(to, "data", "incoming", "NirnsideSnapshot.lua"), "utf8"), "-- mine");
    assert.equal(existsSync(join(to, "data", "incoming", "NirnsideSnapshot.lua")), true);
    assert.equal(readFileSync(join(to, ".nirnside-need-build"), "utf8").trim(), "1");

    rmSync(from, { recursive: true, force: true });
    rmSync(to, { recursive: true, force: true });
  });

  it("refuses to overlay an older GitHub tree over a newer install", () => {
    const from = join(tmpdir(), `nirnside-old-${Date.now()}`);
    const to = join(tmpdir(), `nirnside-new-${Date.now()}`);
    mkdirSync(join(from, "addon", "NirnsideSnapshot"), { recursive: true });
    mkdirSync(join(to, "addon", "NirnsideSnapshot"), { recursive: true });
    mkdirSync(join(to, "scripts"), { recursive: true });
    writeFileSync(join(to, "scripts", "self-update.mjs"), "// local updater");
    writeFileSync(join(to, "addon", "NirnsideSnapshot", "NirnsideSnapshot.txt"), "## Version: 0.9.0\n");
    writeFileSync(join(from, "addon", "NirnsideSnapshot", "NirnsideSnapshot.txt"), "## Version: 0.8.0\n");
    assert.ok(wouldDowngrade(from, to));
    rmSync(from, { recursive: true, force: true });
    rmSync(to, { recursive: true, force: true });
  });
});

function gitAvailable() {
  return spawnSync("git", ["--version"], { encoding: "utf8" }).status === 0;
}

/** A throwaway remote + clone pair wired for the git update path. */
function gitFixture(base) {
  const remote = join(base, "remote");
  const root = join(base, "root");
  mkdirSync(remote, { recursive: true });
  const g = (cwd, args) =>
    spawnSync("git", ["-c", "user.email=test@test", "-c", "user.name=test", ...args], {
      cwd,
      encoding: "utf8",
    });
  g(remote, ["init", "-q"]);
  g(remote, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  writeFileSync(join(remote, "src.txt"), "one\n");
  g(remote, ["add", "."]);
  g(remote, ["commit", "-q", "-m", "one"]);
  const clone = spawnSync("git", ["clone", "-q", remote, root], { encoding: "utf8" });
  assert.equal(clone.status, 0, clone.stderr || "clone failed");
  return { remote, root, g };
}

describe("self-update git path", () => {
  it("forces a rebuild after a git pull changes HEAD", async (t) => {
    if (!gitAvailable()) return t.skip("git is not installed");
    const base = join(tmpdir(), `nirnside-git-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const { remote, root, g } = gitFixture(base);
    // A previous build must not trick the launcher into skipping the rebuild.
    mkdirSync(join(root, ".next"), { recursive: true });
    writeFileSync(join(root, ".next", "BUILD_ID"), "stale\n");

    writeFileSync(join(remote, "src.txt"), "two\n");
    g(remote, ["add", "."]);
    g(remote, ["commit", "-q", "-m", "two"]);

    const code = await runSelfUpdate(root);
    assert.equal(code, 2, "an updated clone asks for a restart");
    assert.equal(readFileSync(join(root, "src.txt"), "utf8"), "two\n");
    assert.equal(readFileSync(join(root, ".nirnside-need-build"), "utf8").trim(), "1");

    rmSync(base, { recursive: true, force: true });
  });

  it("does not force a rebuild when the clone is already up to date", async (t) => {
    if (!gitAvailable()) return t.skip("git is not installed");
    const base = join(tmpdir(), `nirnside-git-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const { root } = gitFixture(base);

    const code = await runSelfUpdate(root);
    assert.equal(code, 0, "nothing to update");
    assert.equal(existsSync(join(root, ".nirnside-need-build")), false);

    rmSync(base, { recursive: true, force: true });
  });

  it("heals a locally-modified clone that would block the pull", async (t) => {
    if (!gitAvailable()) return t.skip("git is not installed");
    const base = join(tmpdir(), `nirnside-git-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const { remote, root, g } = gitFixture(base);

    // A tracked file the incoming commit also touches, modified locally —
    // exactly the state that makes "git pull --ff-only" refuse forever.
    writeFileSync(join(root, "src.txt"), "local-edit\n");
    writeFileSync(join(remote, "src.txt"), "two\n");
    g(remote, ["add", "."]);
    g(remote, ["commit", "-q", "-m", "two"]);

    const code = await runSelfUpdate(root);
    assert.equal(code, 2, "the healed clone must still count as updated");
    assert.equal(readFileSync(join(root, "src.txt"), "utf8"), "two\n", "remote content must win");
    assert.equal(readFileSync(join(root, ".nirnside-need-build"), "utf8").trim(), "1");

    rmSync(base, { recursive: true, force: true });
  });
});
