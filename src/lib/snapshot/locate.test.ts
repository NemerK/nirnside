import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isBundledSamplePath, rankLiveSnapshotFiles } from "./locate";
import { looksLikeBundledSample } from "./load";

function accountLua(name: string, characters: { id: string; name: string }[]) {
  const chars = characters
    .map(
      (c, i) => `{
        ["id"] = "${c.id}",
        ["name"] = "${c.name}",
        ["class"] = "Nightblade",
        ["race"] = "Khajiit",
        ["alliance"] = "Aldmeri Dominion",
        ["level"] = 50,
        ["lastSeen"] = ${10 + i},
      }`,
    )
    .join(",\n");
  return `
    NirnsideData = {
      ["Default"] = {
        ["${name}"] = {
          ["$AccountWide"] = {
            ["displayName"] = "${name}",
            ["lastSnapshot"] = ${characters.length * 100},
            ["characters"] = { ${chars} },
          },
        },
      },
    }
  `;
}

describe("bundled sample path", () => {
  it("recognizes the tour fixture on Windows and POSIX paths", () => {
    assert.equal(isBundledSamplePath("C:\\Users\\Nemer\\nirnside\\data\\sample\\Nirnside.lua"), true);
    assert.equal(isBundledSamplePath("/home/n/nirnside/data/sample/Nirnside.lua"), true);
    assert.equal(
      isBundledSamplePath(
        "C:\\Users\\Nemer\\OneDrive\\Documents\\Elder Scrolls Online\\live\\SavedVariables\\NirnsideSnapshot.lua",
      ),
      false,
    );
  });
});

describe("rankLiveSnapshotFiles", () => {
  it("skips @AzuraStar copies and keeps the account with more characters", () => {
    const dir = mkdtempSync(join(tmpdir(), "nirnside-sv-"));
    mkdirSync(join(dir, "liveeu"), { recursive: true });
    mkdirSync(join(dir, "live"), { recursive: true });
    const sampleCopy = join(dir, "liveeu", "NirnsideSnapshot.lua");
    const live = join(dir, "live", "NirnsideSnapshot.lua");
    writeFileSync(
      sampleCopy,
      accountLua("@AzuraStar", [
        { id: "char-001", name: "Sings-With-Shadows" },
        { id: "char-002", name: "Draugr-Bane" },
        { id: "char-003", name: "Bakes-Sweet-Rolls" },
      ]),
    );
    writeFileSync(
      live,
      accountLua(
        "@Jaegeron",
        Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, name: `Toon${i}` })),
      ),
    );

    const ranked = rankLiveSnapshotFiles([sampleCopy, live]);
    assert.equal(ranked.length, 1, JSON.stringify(ranked));
    assert.equal(ranked[0].displayName, "@Jaegeron");
    assert.equal(ranked[0].characters, 8);
    assert.equal(
      looksLikeBundledSample({ displayName: "@AzuraStar", characters: [{ name: "Sings-With-Shadows" }] }),
      true,
    );

    rmSync(dir, { recursive: true, force: true });
  });

  it("skips a sample roster even when the display name was renamed", () => {
    const dir = mkdtempSync(join(tmpdir(), "nirnside-sv-"));
    const renamed = join(dir, "NirnsideSnapshot.lua");
    const live = join(dir, "real.lua");
    writeFileSync(
      renamed,
      accountLua("@SomeoneElse", [
        { id: "char-001", name: "Sings-With-Shadows" },
        { id: "char-002", name: "Draugr-Bane" },
        { id: "char-003", name: "Bakes-Sweet-Rolls" },
      ]),
    );
    writeFileSync(live, accountLua("@Jaegeron", [{ id: "c1", name: "Ardent" }]));

    const ranked = rankLiveSnapshotFiles([renamed, live]);
    assert.equal(ranked.length, 1, JSON.stringify(ranked));
    assert.equal(ranked[0].displayName, "@Jaegeron");

    rmSync(dir, { recursive: true, force: true });
  });
});
