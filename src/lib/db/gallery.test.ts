import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { GALLERY_MAX_PHOTOS, GalleryError } from "../gallery/rules";

// Photos live beside the db, so each run gets its own folder (not the shared temp dir).
process.env.NIRNSIDE_DB = join(mkdtempSync(join(tmpdir(), "nirnside-gallery-")), "test.db");

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

type Gallery = typeof import("./gallery");
let gallery: Gallery;

before(async () => {
  gallery = await import("./gallery");
});

describe("gallery photos", () => {
  it("keeps character and house photos apart and stops at 20", () => {
    const first = gallery.addGalleryPhoto("character", "char-001", PNG);
    assert.equal(gallery.listGalleryPhotos("character", "char-001").length, 1);
    assert.equal(gallery.listGalleryPhotos("house", "1207").length, 0);
    gallery.addGalleryPhoto("house", "1207", PNG);
    assert.equal(gallery.galleryCounts("character").get("char-001"), 1);
    assert.equal(gallery.galleryCounts("house").get("1207"), 1);

    for (let i = 1; i < GALLERY_MAX_PHOTOS; i++) gallery.addGalleryPhoto("character", "char-001", PNG);
    assert.equal(gallery.listGalleryPhotos("character", "char-001").length, GALLERY_MAX_PHOTOS);
    assert.throws(() => gallery.addGalleryPhoto("character", "char-001", PNG), /20 photos/);
    assert.equal(gallery.listGalleryPhotos("house", "1207").length, 1);

    const read = gallery.readGalleryPhoto("character", "char-001", first.id);
    assert.equal(read?.mime, "image/png");
    assert.equal(read?.bytes.length, PNG.length);

    gallery.deleteGalleryPhoto("character", "char-001", first.id);
    assert.equal(gallery.readGalleryPhoto("character", "char-001", first.id), null);
    assert.equal(gallery.listGalleryPhotos("character", "char-001").some((photo) => photo.id === first.id), false);
    assert.throws(() => gallery.deleteGalleryPhoto("character", "char-001", first.id), GalleryError);
  });

  it("does not store a file that is not a photo, or write outside the gallery folder", () => {
    assert.throws(() => gallery.addGalleryPhoto("character", "char-001", Buffer.from("not a photo")), /JPEG/);
    assert.throws(() => gallery.addGalleryPhoto("character", "../secret", PNG), GalleryError);
    const dir = join(dirname(process.env.NIRNSIDE_DB as string), "gallery", "character", "char-001");
    const names = readdirSync(dir);
    assert.equal(names.length, GALLERY_MAX_PHOTOS - 1);
    assert.equal(names.every((name) => /^[a-f0-9]{16}\.png$/.test(name)), true);
  });
});
