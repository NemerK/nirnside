import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyLauncherResponse,
  launcherCandidates,
  outsideJobCommand,
  planUpdate,
} from "./update-handoff";

describe("launcher candidates", () => {
  it("tries the env url first, then the exe's ports, without duplicates", () => {
    assert.deepEqual(launcherCandidates(null), [
      "http://127.0.0.1:43218/api/apply-update",
      "http://127.0.0.1:43217/api/apply-update",
    ]);
    assert.deepEqual(launcherCandidates("http://127.0.0.1:43218/api/apply-update"), [
      "http://127.0.0.1:43218/api/apply-update",
      "http://127.0.0.1:43217/api/apply-update",
    ]);
    assert.deepEqual(launcherCandidates("http://127.0.0.1:44000/api/apply-update"), [
      "http://127.0.0.1:44000/api/apply-update",
      "http://127.0.0.1:43218/api/apply-update",
      "http://127.0.0.1:43217/api/apply-update",
    ]);
  });
});

describe("classify launcher response", () => {
  it("accepts the apply endpoint and ignores everything else", () => {
    assert.equal(classifyLauncherResponse(200, '{"ok":true,"restarting":true}'), "accept");
    assert.equal(classifyLauncherResponse(409, '{"error":"update already running"}'), "accept");
    assert.equal(classifyLauncherResponse(404, "404 page not found"), "miss");
    assert.equal(classifyLauncherResponse(200, "<html>not the launcher</html>"), "miss");
    assert.equal(classifyLauncherResponse(500, '{"ok":true}'), "miss");
  });
});

describe("plan update", () => {
  it("leaves the Windows launcher job, and detaches everywhere else", () => {
    assert.equal(planUpdate({ platform: "win32", parentIsLauncher: true }), "outside-job");
    assert.equal(planUpdate({ platform: "win32", parentIsLauncher: null }), "outside-job");
    assert.equal(planUpdate({ platform: "win32", parentIsLauncher: false }), "detached");
    assert.equal(planUpdate({ platform: "linux", parentIsLauncher: true }), "detached");
  });
});

describe("outside job command", () => {
  it("asks WMI to start the helper with the install as its directory", () => {
    const cmd = outsideJobCommand({
      node: "C:\\Program Files\\Nirnside\\runtime\\node.exe",
      script: "C:\\Program Files\\Nirnside\\scripts\\apply-update.mjs",
      root: "C:\\Users\\O'Brien\\Nirnside",
      pid: 4242,
      dev: false,
    });
    assert.equal(cmd.file, "powershell.exe");
    assert.deepEqual(cmd.args.slice(0, 3), ["-NoProfile", "-NonInteractive", "-Command"]);
    const script = cmd.args[3] ?? "";
    assert.match(script, /Invoke-CimMethod -ClassName Win32_Process -MethodName Create/);
    assert.match(script, /\$created\.ReturnValue -ne 0/);
    assert.match(script, /"C:\\Program Files\\Nirnside\\runtime\\node.exe"/);
    assert.match(script, /--pid 4242/);
    assert.match(script, /--dev 0/);
    assert.match(script, /O''Brien/);
    assert.match(script, /CurrentDirectory = 'C:\\Users\\O''Brien\\Nirnside'/);
  });
});
