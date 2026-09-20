import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveUserPath } from "./resolve-path";

function fakeEsoTree(parent: string, env = "liveeu") {
  const root = join(parent, "Elder Scrolls Online");
  mkdirSync(join(root, env, "SavedVariables"), { recursive: true });
  mkdirSync(join(root, env, "AddOns"), { recursive: true });
  return { root, envDir: join(root, env), sv: join(root, env, "SavedVariables") };
}

describe("resolveUserPath", () => {
  const dir = mkdtempSync(join(tmpdir(), "nirnside-eso-"));
  const { root, envDir, sv } = fakeEsoTree(dir);

  it("accepts the Elder Scrolls Online folder", () => {
    const r = resolveUserPath(root);
    assert.equal(r.ok, true);
    if (r.ok && r.kind === "eso-root") {
      assert.equal(r.esoRoot, root);
      assert.ok(r.envs.includes("liveeu"));
    }
  });

  it("accepts liveeu itself", () => {
    const r = resolveUserPath(envDir);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.kind, "eso-root");
  });

  it("accepts SavedVariables", () => {
    const r = resolveUserPath(sv);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.kind, "eso-root");
  });

  it("accepts a snapshot lua", () => {
    const file = join(sv, "NirnsideSnapshot.lua");
    writeFileSync(file, "NirnsideData = {}\n");
    const r = resolveUserPath(file);
    assert.equal(r.ok, true);
    if (r.ok && r.kind === "snapshot") {
      assert.equal(r.file, file);
      assert.ok(r.esoRoot);
    }
  });

  it("accepts Documents as a parent of the ESO folder", () => {
    const r = resolveUserPath(dir);
    assert.equal(r.ok, true);
    if (r.ok && r.kind === "eso-root") assert.equal(r.esoRoot, root);
  });

  it("rejects junk", () => {
    const r = resolveUserPath(join(dir, "nope"));
    assert.equal(r.ok, false);
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });
});
