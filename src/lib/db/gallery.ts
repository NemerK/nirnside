import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { getDb } from "./index";
import {
  GALLERY_MAX_PHOTOS,
  GalleryError,
  checkGalleryBytes,
  isGalleryPhotoId,
  parseGalleryOwner,
  type GalleryImage,
  type GalleryKind,
} from "../gallery/rules";

export type GalleryPhoto = {
  id: string;
  createdAt: number;
};

function galleryRoot(): string {
  const dbPath = resolve(process.env.NIRNSIDE_DB ?? "./data/nirnside.db");
  return join(dirname(dbPath), "gallery");
}

function ownerOrThrow(kind: string, id: string): { kind: GalleryKind; id: string } {
  const owner = parseGalleryOwner(kind, id);
  if (!owner) throw new GalleryError("That gallery does not exist.");
  return owner;
}

function photoPath(owner: { kind: GalleryKind; id: string }, photoId: string, ext: string): string {
  if (!isGalleryPhotoId(photoId)) throw new GalleryError("That photo is not in this gallery.");
  if (ext !== "jpg" && ext !== "png" && ext !== "webp" && ext !== "gif") {
    throw new GalleryError("That photo is not in this gallery.");
  }
  return join(galleryRoot(), owner.kind, owner.id, `${photoId}.${ext}`);
}

export function listGalleryPhotos(kind: string, ownerId: string): GalleryPhoto[] {
  const owner = ownerOrThrow(kind, ownerId);
  const rows = getDb()
    .prepare(
      `SELECT id, createdAt FROM gallery_photos
       WHERE ownerKind = ? AND ownerId = ?
       ORDER BY createdAt ASC, id ASC`,
    )
    .all(owner.kind, owner.id) as GalleryPhoto[];
  return rows;
}

export function galleryCounts(kind: GalleryKind): Map<string, number> {
  const rows = getDb()
    .prepare(`SELECT ownerId, COUNT(*) AS n FROM gallery_photos WHERE ownerKind = ? GROUP BY ownerId`)
    .all(kind) as { ownerId: string; n: number }[];
  return new Map(rows.map((row) => [row.ownerId, row.n]));
}

export function addGalleryPhoto(kind: string, ownerId: string, bytes: Uint8Array): GalleryPhoto {
  const owner = ownerOrThrow(kind, ownerId);
  const image = checkGalleryBytes(bytes);
  const id = randomBytes(8).toString("hex");
  const createdAt = Date.now();
  const path = photoPath(owner, id, image.ext);
  const db = getDb();
  const insert = db.transaction(() => {
    const count = db
      .prepare(`SELECT COUNT(*) AS n FROM gallery_photos WHERE ownerKind = ? AND ownerId = ?`)
      .get(owner.kind, owner.id) as { n: number };
    if (count.n >= GALLERY_MAX_PHOTOS) {
      throw new GalleryError(`This gallery already has ${GALLERY_MAX_PHOTOS} photos.`);
    }
    db.prepare(
      `INSERT INTO gallery_photos (id, ownerKind, ownerId, ext, bytes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, owner.kind, owner.id, image.ext, bytes.length, createdAt);
  });
  insert();
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, bytes);
  } catch (err) {
    db.prepare(`DELETE FROM gallery_photos WHERE id = ?`).run(id);
    throw err;
  }
  return { id, createdAt };
}

export function readGalleryPhoto(
  kind: string,
  ownerId: string,
  photoId: string,
): { bytes: Buffer; mime: GalleryImage["mime"] } | null {
  const owner = parseGalleryOwner(kind, ownerId);
  if (!owner || !isGalleryPhotoId(photoId)) return null;
  const row = getDb()
    .prepare(`SELECT ext FROM gallery_photos WHERE id = ? AND ownerKind = ? AND ownerId = ?`)
    .get(photoId, owner.kind, owner.id) as { ext: string } | undefined;
  if (!row) return null;
  let path: string;
  try {
    path = photoPath(owner, photoId, row.ext);
  } catch {
    return null;
  }
  try {
    const bytes = readFileSync(path);
    const image = checkGalleryBytes(bytes);
    if (image.ext !== row.ext) return null;
    return { bytes, mime: image.mime };
  } catch {
    return null;
  }
}

export function deleteGalleryPhoto(kind: string, ownerId: string, photoId: string): void {
  const owner = ownerOrThrow(kind, ownerId);
  if (!isGalleryPhotoId(photoId)) throw new GalleryError("That photo is not in this gallery.");
  const row = getDb()
    .prepare(`SELECT ext FROM gallery_photos WHERE id = ? AND ownerKind = ? AND ownerId = ?`)
    .get(photoId, owner.kind, owner.id) as { ext: string } | undefined;
  if (!row) throw new GalleryError("That photo is not in this gallery.");
  const path = photoPath(owner, photoId, row.ext);
  const result = getDb()
    .prepare(`DELETE FROM gallery_photos WHERE id = ? AND ownerKind = ? AND ownerId = ?`)
    .run(photoId, owner.kind, owner.id);
  if (result.changes === 0) throw new GalleryError("That photo is not in this gallery.");
  rmSync(path, { force: true });
}
