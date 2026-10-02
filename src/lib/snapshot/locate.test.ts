import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chooseEsoSnapshot, envFolders, isBundledSamplePath } from "./locate";

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
    assert.equal(
      isBundledSamplePath(
        "C:\\Users\\Nemer\\Documents\\Elder Scrolls Online\\liveeu\\SavedVariables\\NirnsideSnapshot.lua",
      ),
      false,
    );
  });
});

describe("ESO env folders", () => {
  it("lists liveeu and live when both exist — neither is dropped", () => {
    const dir = mkdtempSync(join(tmpdir(), "nirnside-eso-"));
    mkdirSync(join(dir, "liveeu", "SavedVariables"), { recursive: true });
    mkdirSync(join(dir, "live", "SavedVariables"), { recursive: true });
    mkdirSync(join(dir, "pts", "SavedVariables"), { recursive: true });
    assert.deepEqual(envFolders(dir), ["liveeu", "live", "pts"]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("chooseEsoSnapshot", () => {
  it("keeps a liveeu account when live only has the sample leftover", () => {
    const dir = mkdtempSync(join(tmpdir(), "nirnside-sv-"));
    const liveeu = join(dir, "liveeu", "NirnsideSnapshot.lua");
    const live = join(dir, "live", "NirnsideSnapshot.lua");
    mkdirSync(join(dir, "liveeu"), { recursive: true });
    mkdirSync(join(dir, "live"), { recursive: true });
    writeFileSync(live, accountLua("@AzuraStar", [{ id: "s1", name: "Sings-With-Shadows" }]));
    writeFileSync(
      liveeu,
      accountLua(
        "@OtherEU",
        Array.from({ length: 5 }, (_, i) => ({ id: `e${i}`, name: `EU${i}` })),
      ),
    );

    assert.equal(chooseEsoSnapshot([live, liveeu]), liveeu);
    rmSync(dir, { recursive: true, force: true });
  });

  it("keeps a live account when liveeu only has the sample leftover", () => {
    const dir = mkdtempSync(join(tmpdir(), "nirnside-sv-"));
    const liveeu = join(dir, "liveeu", "NirnsideSnapshot.lua");
    const live = join(dir, "live", "NirnsideSnapshot.lua");
    mkdirSync(join(dir, "liveeu"), { recursive: true });
    mkdirSync(join(dir, "live"), { recursive: true });
    writeFileSync(
      liveeu,
      accountLua("@AzuraStar", [
        { id: "char-001", name: "Sings-With-Shadows" },
        { id: "char-002", name: "Draugr-Bane" },
      ]),
    );
    writeFileSync(
      live,
      accountLua(
        "@Jaegeron",
        Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, name: `Toon${i}` })),
      ),
    );

    assert.equal(chooseEsoSnapshot([liveeu, live]), live);
    rmSync(dir, { recursive: true, force: true });
  });

  it("uses the only ESO file when that folder is liveeu", () => {
    const dir = mkdtempSync(join(tmpdir(), "nirnside-sv-"));
    const liveeu = join(dir, "liveeu", "NirnsideSnapshot.lua");
    mkdirSync(join(dir, "liveeu"), { recursive: true });
    writeFileSync(liveeu, accountLua("@OnlyEU", [{ id: "c1", name: "Ardent" }]));

    assert.equal(chooseEsoSnapshot([liveeu]), liveeu);
    rmSync(dir, { recursive: true, force: true });
  });
});
