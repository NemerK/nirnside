import { dataDir } from "../data-dir";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "./index";
import { GalleryError, checkGalleryBytes, type GalleryImage } from "../gallery/rules";
import { isProfileKind, type ProfileKind, type ProfileMedia } from "../profile/media";

export type { ProfileKind, ProfileMedia };

const EXTS = new Set(["jpg", "png", "webp", "gif"]);

export class ProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileError";
  }
}

function profileRoot(): string {
  return join(/* turbopackIgnore: true */ dataDir(), "profile");
}

function mediaPath(kind: ProfileKind, ext: string): string {
  if (!EXTS.has(ext)) throw new ProfileError("That picture is not saved.");
  return join(/* turbopackIgnore: true */ profileRoot(), `${kind}.${ext}`);
}

type Row = { kind: ProfileKind; ext: string; bytes: number; updatedAt: number };

function row(kind: ProfileKind): Row | undefined {
  const found = getDb().prepare(`SELECT kind, ext, bytes, updatedAt FROM profile_media WHERE kind = ?`).get(kind) as Row | undefined;
  if (!found || !isProfileKind(found.kind)) return undefined;
  return found;
}

/** Updated times for pictures that are actually on disk. Missing files count as unset. */
export function profileMedia(): ProfileMedia {
  const media: ProfileMedia = { avatar: null, banner: null };
  for (const kind of ["avatar", "banner"] as const) {
    const saved = row(kind);
    if (!saved) continue;
    try {
      if (existsSync(/* turbopackIgnore: true */ mediaPath(kind, saved.ext))) media[kind] = saved.updatedAt;
    } catch {
      /* A bad row must not take down Home. */
    }
  }
  return media;
}

export function setProfileImage(kind: ProfileKind, bytes: Uint8Array): { updatedAt: number } {
  let image: GalleryImage;
  try {
    image = checkGalleryBytes(bytes);
  } catch (err) {
    if (err instanceof GalleryError) throw new ProfileError(err.message);
    throw err;
  }
  const db = getDb();
  const prev = row(kind);
  const updatedAt = Date.now();
  const path = mediaPath(kind, image.ext);
  db.prepare(
    `INSERT INTO profile_media (kind, ext, bytes, updatedAt) VALUES (?, ?, ?, ?)
     ON CONFLICT(kind) DO UPDATE SET ext = excluded.ext, bytes = excluded.bytes, updatedAt = excluded.updatedAt`,
  ).run(kind, image.ext, bytes.length, updatedAt);
  try {
    mkdirSync(profileRoot(), { recursive: true });
    writeFileSync(path, bytes);
    if (prev && prev.ext !== image.ext) rmSync(mediaPath(kind, prev.ext), { force: true });
  } catch (err) {
    if (prev) {
      db.prepare(`UPDATE profile_media SET ext = ?, bytes = ?, updatedAt = ? WHERE kind = ?`).run(prev.ext, prev.bytes, prev.updatedAt, kind);
    } else {
      db.prepare(`DELETE FROM profile_media WHERE kind = ?`).run(kind);
    }
    throw err;
  }
  return { updatedAt };
}

export function readProfileImage(kind: ProfileKind): { bytes: Buffer; mime: GalleryImage["mime"] } | null {
  const saved = row(kind);
  if (!saved) return null;
  let path: string;
  try {
    path = mediaPath(kind, saved.ext);
  } catch {
    return null;
  }
  try {
    const bytes = readFileSync(/* turbopackIgnore: true */ path);
    const image = checkGalleryBytes(bytes);
    if (image.ext !== saved.ext) return null;
    return { bytes, mime: image.mime };
  } catch {
    return null;
  }
}

export function clearProfileImage(kind: ProfileKind): void {
  const saved = row(kind);
  if (!saved) throw new ProfileError("There is no picture to remove.");
  getDb().prepare(`DELETE FROM profile_media WHERE kind = ?`).run(kind);
  try {
    rmSync(mediaPath(kind, saved.ext), { force: true });
  } catch {
    /* The row is gone, so Home will not ask for the file. */
  }
}
