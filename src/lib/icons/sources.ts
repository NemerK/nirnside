/** A fetched image we are willing to cache and serve. */
export type IconBytes = {
  body: Buffer;
  contentType: "image/png" | "image/jpeg" | "image/webp";
};

/**
 * Public mirrors for in-game texture paths. UESP is the full tree; it currently
 * answers many requests with a Cloudflare challenge, so basename mirrors are
 * tried after it. We never bundle the game's art.
 */
const FILE_MIRRORS = [
  "https://assets.rpglogs.com/img/eso/abilities",
  "https://eso-hub.com/storage/icons",
];

export function iconContentType(body: Buffer): IconBytes["contentType"] | null {
  if (body.length >= 8 && body[0] === 0x89 && body[1] === 0x50 && body[2] === 0x4e && body[3] === 0x47) {
    return "image/png";
  }
  if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return "image/jpeg";
  if (body.length >= 12 && body.toString("ascii", 0, 4) === "RIFF" && body.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

/** URLs to try, in order, for a normalized `esoui/...png` path. */
export function iconFetchUrls(normalizedPath: string, upstreams: string[]): string[] {
  const urls = upstreams.map((base) => `${base.replace(/\/$/, "")}/${normalizedPath}`);
  const file = normalizedPath.split("/").pop() ?? "";
  const stem = file.replace(/\.(png|jpe?g|webp)$/i, "");
  if (/^[a-z0-9_-]+$/i.test(stem)) {
    for (const base of FILE_MIRRORS) urls.push(`${base}/${stem}.png`);
  }
  return urls;
}
