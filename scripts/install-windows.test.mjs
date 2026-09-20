import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("Windows first-run must not compile SQLite", () => {
  it("disables npm lifecycle scripts so node-gyp never runs", () => {
    const npmrc = readFileSync(join(root, ".npmrc"), "utf8");
    assert.match(npmrc, /^\s*ignore-scripts\s*=\s*true\s*$/m);
  });

  it("start-nirnside.cmd skips scripts and requires Node 22+", () => {
    const cmd = readFileSync(join(root, "start-nirnside.cmd"), "utf8");
    assert.match(cmd, /npm install --ignore-scripts/);
    assert.match(cmd, /check-sqlite\.mjs/);
    assert.match(cmd, /LSS 22/);
    assert.match(cmd, /Visual Studio is not required/i);
  });

  it("start-nirnside.sh skips scripts and requires Node 22+", () => {
    const sh = readFileSync(join(root, "start-nirnside.sh"), "utf8");
    assert.match(sh, /npm install --ignore-scripts/);
    assert.match(sh, /check-sqlite\.mjs/);
    assert.match(sh, /NODE_MAJOR" -lt 22/);
  });

  it("bundled SQLite loads without compiling", async () => {
    const { spawnSync } = await import("node:child_process");
    const r = spawnSync(process.execPath, [join(root, "scripts", "check-sqlite.mjs")], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });
});
