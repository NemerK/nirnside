import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
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

export async function GET(req: Request) {
  const path = normalizePath(new URL(req.url).searchParams.get("p") || "");
  if (!path) return new Response("bad icon path", { status: 400 });

  const file = join(CACHE_DIR, `${createHash("sha1").update(path).digest("hex")}.png`);

  try {
    if (existsSync(file)) {
      const cached = await readFile(file);
      const contentType = iconContentType(cached);
      if (contentType) return new Response(new Uint8Array(cached), { headers: imageHeaders(contentType) });
    }
  } catch {
    // Fall through to a fresh fetch.
  }

  const image = await fetchUpstream(path);
  if (!image) return new Response("icon not found", { status: 404 });

  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(file, image.body);
  } catch {
    // Serving still works even if the cache write fails.
  }
  return new Response(new Uint8Array(image.body), { headers: imageHeaders(image.contentType) });
}
