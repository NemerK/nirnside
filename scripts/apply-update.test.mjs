import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyAndRestart, npmInstallArgs, serverArgs } from "./apply-update.mjs";

describe("apply-update", () => {
  it("starts the dev server without a build, and production with one", () => {
    assert.deepEqual(serverArgs(true), ["dev", "-H", "127.0.0.1", "-p", "43219"]);
    assert.deepEqual(serverArgs(false), ["start", "-H", "127.0.0.1", "-p", "43219"]);
  });

  it("uses the bundled npm when the runtime is present, otherwise npm on PATH", () => {
    const root = mkdtempSync(join(tmpdir(), "nirnside-apply-"));
    try {
      const plain = npmInstallArgs(root);
      if (process.platform === "win32") {
        assert.equal(plain.cmd, "cmd.exe");
        assert.ok(plain.args.includes("npm.cmd"));
      } else {
        assert.equal(plain.cmd, "npm");
        assert.deepEqual(plain.args, ["install", "--ignore-scripts", "--no-audit", "--no-fund"]);
      }
      const bundled = process.platform === "win32" ? join(root, "runtime", "npm.cmd") : join(root, "runtime", "bin", "npm");
      mkdirSync(join(bundled, ".."), { recursive: true });
      writeFileSync(bundled, "");
      const local = npmInstallArgs(root);
      if (process.platform === "win32") {
        assert.ok(local.args.includes(bundled));
      } else {
        assert.equal(local.cmd, bundled);
        assert.deepEqual(local.args, ["install", "--ignore-scripts", "--no-audit", "--no-fund"]);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("applies the update, then starts the server, without touching a real install", async () => {
    const root = mkdtempSync(join(tmpdir(), "nirnside-apply-"));
    const calls = [];
    try {
      await applyAndRestart(root, {
        pid: 0,
        dev: true,
        runUpdate: async () => {
          calls.push("update");
        },
        run: (cmd, args) => {
          calls.push(`${cmd} ${args.join(" ")}`);
          return 0;
        },
        start: (args) => {
          calls.push(args.join(" "));
        },
      });
      assert.equal(calls[0], "update");
      assert.match(calls[1], /npm install --ignore-scripts --no-audit --no-fund$/);
      assert.equal(calls.at(-1), "dev -H 127.0.0.1 -p 43219");
      assert.equal(calls.some((line) => line.includes(" build")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
