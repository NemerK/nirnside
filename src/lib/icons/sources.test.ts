import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { iconContentType, iconFetchUrls, iconFileStem, iconImageUrls } from "./sources";

describe("icon mirrors", () => {
  it("tries the full UESP path, then basename mirrors", () => {
    const urls = iconFetchUrls("esoui/art/icons/ability_nightblade_005.png", ["https://esoicons.uesp.net"]);
    assert.deepEqual(urls, [
      "https://esoicons.uesp.net/esoui/art/icons/ability_nightblade_005.png",
      "https://assets.rpglogs.com/img/eso/abilities/ability_nightblade_005.png",
      "https://eso-hub.com/storage/icons/ability_nightblade_005.png",
    ]);
  });

  it("pulls a filename out of a game texture path", () => {
    assert.equal(iconFileStem("/esoui/art/icons/ability_2handed_006.dds"), "ability_2handed_006");
    assert.equal(
      iconImageUrls("/esoui/art/icons/ability_2handed_006.dds").at(-1),
      "https://eso-hub.com/storage/icons/ability_2handed_006.png",
    );
  });

  it("rejects a non-image body", () => {
    assert.equal(iconContentType(Buffer.from("<html>challenge</html>")), null);
    assert.equal(iconContentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  });
});
