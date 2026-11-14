import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canRestartWithoutLauncher, looksLikeLauncherParent } from "./launcher-parent";
import { isUpdateAvailable, launcherApplyUrl, launcherOrigin } from "./update-status";

describe("launcher parent", () => {
  it("recognises the Windows exe and lets every other parent restart itself", () => {
    assert.equal(looksLikeLauncherParent('"Nirnside.exe","4321","Console","1","20,000 K"'), true);
    assert.equal(looksLikeLauncherParent('"node.exe","4321","Console","1","20,000 K"'), false);
    assert.equal(canRestartWithoutLauncher(true, "win32"), false);
    assert.equal(canRestartWithoutLauncher(null, "win32"), false);
    assert.equal(canRestartWithoutLauncher(false, "win32"), true);
    assert.equal(canRestartWithoutLauncher(null, "linux"), true);
  });
});

describe("isUpdateAvailable", () => {
  it("offers an update when main has moved, including a fresh install with no revision", () => {
    assert.equal(isUpdateAvailable("aaa", "bbb", false), true);
    assert.equal(isUpdateAvailable(null, "bbb", false), true);
    assert.equal(isUpdateAvailable("", "bbb", false), true);
  });

  it("stays quiet when the install matches, the check failed, or updates are skipped", () => {
    assert.equal(isUpdateAvailable("abc", "abc", false), false);
    assert.equal(isUpdateAvailable("abc", null, false), false);
    assert.equal(isUpdateAvailable("abc", "def", true), false);
    assert.equal(isUpdateAvailable(null, null, false), false);
  });
});

describe("launcherApplyUrl", () => {
  it("accepts the local launcher and rejects anything else", () => {
    assert.equal(launcherApplyUrl("http://127.0.0.1:43218"), "http://127.0.0.1:43218/api/apply-update");
    assert.equal(launcherApplyUrl("http://127.0.0.1:43218/"), "http://127.0.0.1:43218/api/apply-update");
    assert.equal(launcherApplyUrl("http://localhost:43218"), "http://localhost:43218/api/apply-update");
    assert.equal(launcherApplyUrl("https://127.0.0.1:43218"), null);
    assert.equal(launcherApplyUrl("http://example.com"), null);
    assert.equal(launcherApplyUrl("http://127.0.0.1:43218.evil.com"), null);
    assert.equal(launcherApplyUrl(""), null);
    assert.equal(launcherApplyUrl(undefined), null);
    assert.equal(launcherOrigin("http://127.0.0.1:43218/"), "http://127.0.0.1:43218");
    assert.equal(launcherOrigin("http://evil.test"), null);
  });
});
