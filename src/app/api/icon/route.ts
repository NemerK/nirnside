import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { iconContentType, iconFetchUrls, type IconBytes } from "@/lib/icons/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Local icon proxy + cache.
 *
 * ESO exposes icons as in-game .dds texture paths (e.g.
 * "/esoui/art/icons/gear_breton_heavy_helmet_a.dds"). We never extract or bundle
 * the game's art. Instead this route — running on the user's own machine —
 * fetches the PNG from a public icon mirror, caches it to disk, and
 * serves it locally. UESP is tried first; if that host challenges the request,
 * the same filename is loaded from Warcraft Logs and ESO-Hub. This is strictly
 * better than hotlinking from the browser:
 *
 *   - It sets a proper User-Agent/Referer, which sidesteps hotlink protection
 *     that silently blocks some cross-origin <img> loads.
 *   - It caches every icon to disk, so after the first view everything is
 *     instant and works fully offline.
 *   - Fallback upstreams live in one place, so coverage can improve over time
 *     without touching the UI.
 *
 * If every upstream genuinely lacks a file we return 404 and the UI shows a
 * labeled placeholder — but that is now the rare exception, not the norm.
 */
const UPSTREAMS = (process.env.NIRNSIDE_ICON_UPSTREAM || "https://esoicons.uesp.net")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

const CACHE_DIR = join(process.cwd(), ".cache", "icons");

/**
 * Hot icons are held in a small memory cache so a page full of the same art
 * (and every later navigation) never re-reads disk or re-hits the network.
 * Concurrent requests for one path share a single fetch instead of stampeding.
 */
const MEM_MAX_ENTRIES = 600;
const memCache = new Map<string, IconBytes>();
const inflight = new Map<string, Promise<IconBytes | null>>();

function memGet(key: string): IconBytes | null {
  const hit = memCache.get(key);
  if (!hit) return null;
  // Refresh recency (Map keeps insertion order → last entry is newest).
  memCache.delete(key);
  memCache.set(key, hit);
  return hit;
}

function memSet(key: string, value: IconBytes): void {
  memCache.set(key, value);
  while (memCache.size > MEM_MAX_ENTRIES) {
    const oldest = memCache.keys().next().value;
    if (oldest === undefined) break;
    memCache.delete(oldest);
  }
}

/** Normalize a raw in-game icon path to a safe, upstream-relative PNG path. */
function normalizePath(raw: string): string | null {
  if (!raw) return null;
  let p = raw.replace(/\\/g, "/").split(/[?#]/)[0].replace(/^\/+/, "").toLowerCase();
  if (!p || p.includes("..")) return null;
  if (!/^[a-z0-9_\-/.]+$/.test(p)) return null;
  if (!p.startsWith("esoui/")) {
    // Bare filename → assume the standard icons directory; anything else is unknown.
    if (p.includes("/")) return null;
    p = `esoui/art/icons/${p}`;
  }
  if (p.endsWith(".dds")) p = `${p.slice(0, -4)}.png`;
  else if (!/\.(png|jpe?g|webp)$/.test(p)) p = `${p}.png`;
  return p;
}

function imageHeaders(contentType: string): HeadersInit {
  return {
    "Content-Type": contentType,
    // Immutable per URL — icon art for a given path never changes.
    "Cache-Control": "public, max-age=31536000, immutable",
  };
}

async function fetchUpstream(path: string): Promise<IconBytes | null> {
  for (const url of iconFetchUrls(path, UPSTREAMS)) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          Accept: "image/png,image/webp,image/*;q=0.9,*/*;q=0.5",
        },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const body = Buffer.from(await res.arrayBuffer());
      const contentType = iconContentType(body);
      if (!contentType) continue;
      return { body, contentType };
    } catch {
      // Try the next mirror.
    }
  }
  return null;
}

/** Read the on-disk cache in one syscall; missing/corrupt files just miss. */
async function readDisk(file: string): Promise<IconBytes | null> {
  try {
    const body = await readFile(file);
    const contentType = iconContentType(body);
    return contentType ? { body, contentType } : null;
  } catch {
    return null;
  }
}

/** Resolve one icon: memory → disk → network, with single-flight per path. */
async function loadIcon(path: string, file: string): Promise<IconBytes | null> {
  const cached = memGet(path);
  if (cached) return cached;

  const pending = inflight.get(path);
  if (pending) return pending;

  const work = (async () => {
    const onDisk = await readDisk(file);
    if (onDisk) {
      memSet(path, onDisk);
      return onDisk;
    }
    const fetched = await fetchUpstream(path);
    if (!fetched) return null;
    memSet(path, fetched);
    void mkdir(CACHE_DIR, { recursive: true })
      .then(() => writeFile(file, fetched.body))
      .catch(() => {
        // Serving still works even if the disk write fails.
      });
    return fetched;
  })();

  inflight.set(path, work);
  try {
    return await work;
  } finally {
    inflight.delete(path);
  }
}

export async function GET(req: Request) {
  const path = normalizePath(new URL(req.url).searchParams.get("p") || "");
  if (!path) return new Response("bad icon path", { status: 400 });

  const file = join(CACHE_DIR, `${createHash("sha1").update(path).digest("hex")}.png`);
  const image = await loadIcon(path, file);
  if (!image) return new Response("icon not found", { status: 404 });
  return new Response(new Uint8Array(image.body), { headers: imageHeaders(image.contentType) });
}
