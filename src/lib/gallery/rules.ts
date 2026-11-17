/** Photos a player attaches to one character or one owned house. */
export const GALLERY_MAX_PHOTOS = 20;

/** A phone photo is welcome. Larger files are refused so one gallery cannot fill the disk. */
export const GALLERY_MAX_BYTES = 12 * 1024 * 1024;

export type GalleryKind = "character" | "house";

export type GalleryImage = {
  ext: "jpg" | "png" | "webp" | "gif";
  mime: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
};

const CHARACTER_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const HOUSE_ID = /^[0-9]{1,12}$/;
const PHOTO_ID = /^[a-f0-9]{16}$/;

export class GalleryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GalleryError";
  }
}

/** Kind and id that are safe to use as a folder name. Anything else is refused. */
export function parseGalleryOwner(kind: string, id: string): { kind: GalleryKind; id: string } | null {
  const ownerId = id.trim();
  if (kind === "character" && CHARACTER_ID.test(ownerId)) return { kind, id: ownerId };
  if (kind === "house" && HOUSE_ID.test(ownerId)) return { kind, id: ownerId };
  return null;
}

export function isGalleryPhotoId(id: string): boolean {
  return PHOTO_ID.test(id);
}

/**
 * Identify a JPEG, PNG, WebP, or GIF from the file itself.
 * The browser's declared type is not trusted.
 */
export function sniffImage(bytes: Uint8Array): GalleryImage | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", mime: "image/jpeg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { ext: "png", mime: "image/png" };
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    const version = bytes[4];
    if ((version === 0x37 || version === 0x39) && bytes[5] === 0x61) return { ext: "gif", mime: "image/gif" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

export function checkGalleryBytes(bytes: Uint8Array): GalleryImage {
  if (bytes.length === 0) throw new GalleryError("That file is empty.");
  if (bytes.length > GALLERY_MAX_BYTES) throw new GalleryError("Each photo must be 12 MB or smaller.");
  const image = sniffImage(bytes);
  if (!image) throw new GalleryError("Use a JPEG, PNG, WebP, or GIF.");
  return image;
}
