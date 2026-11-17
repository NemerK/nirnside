import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GALLERY_MAX_BYTES, GalleryError, checkGalleryBytes, parseGalleryOwner, sniffImage } from "./rules";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("gallery rules", () => {
  it("accepts a roster id and a house collectible id", () => {
    assert.deepEqual(parseGalleryOwner("character", "char-001"), { kind: "character", id: "char-001" });
    assert.deepEqual(parseGalleryOwner("house", "1207"), { kind: "house", id: "1207" });
  });

  it("refuses a path and an unknown kind", () => {
    assert.equal(parseGalleryOwner("character", "../nirnside"), null);
    assert.equal(parseGalleryOwner("character", "char/001"), null);
    assert.equal(parseGalleryOwner("house", "12a"), null);
    assert.equal(parseGalleryOwner("account", "1"), null);
  });

  it("recognizes the four image kinds and refuses other files", () => {
    assert.equal(sniffImage(PNG)?.ext, "png");
    assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))?.ext, "jpg");
    assert.equal(sniffImage(Buffer.from("GIF89a", "ascii"))?.ext, "gif");
    const webp = Buffer.alloc(12);
    webp.write("RIFF", 0);
    webp.write("WEBP", 8);
    assert.equal(sniffImage(webp)?.ext, "webp");
    assert.equal(sniffImage(Buffer.from("<svg></svg>")), null);
    assert.equal(sniffImage(Buffer.alloc(0)), null);
  });

  it("refuses an empty file and a file over 12 MB", () => {
    assert.throws(() => checkGalleryBytes(Buffer.alloc(0)), GalleryError);
    const big = Buffer.alloc(GALLERY_MAX_BYTES + 1);
    big[0] = 0xff;
    big[1] = 0xd8;
    big[2] = 0xff;
    assert.throws(() => checkGalleryBytes(big), /12 MB/);
    assert.equal(checkGalleryBytes(PNG).mime, "image/png");
  });
});
