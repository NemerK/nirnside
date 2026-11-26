import type { NextConfig } from "next";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pruneStale } from "./scripts/prune-stale.mjs";

// Installed copies (the Windows app, ZIP downloads) have no .git folder.
// They only ever need a working build: type errors are caught by CI and on
// developer machines, never on a player's PC.
const playerInstall = !existsSync(join(process.cwd(), ".git"));

// ZIP/exe installs update by copying files over the old folder, so a file a
// release moved stays behind and breaks the build with duplicate routes.
// The build loads this config fresh from disk right after an update, so the
// cleanup runs before Next looks for pages. It only removes known leftovers.
try {
  const removed = pruneStale(process.cwd());
  if (removed.length > 0) console.log(`[nirnside] removed ${removed.length} leftover file(s) from an older version.`);
} catch {
  /* never block a build on cleanup */
}

// Dev-server caches (.next/dev) are never used by `next start`, and their
// generated route types from an older version break the type check. Players
// never run the dev server, so drop them on installed copies.
if (playerInstall) {
  try {
    rmSync(join(process.cwd(), ".next", "dev"), { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; keep it out of the bundler.
  serverExternalPackages: ["better-sqlite3"],
  // Skip the developer type check on players' machines (see playerInstall).
  typescript: { ignoreBuildErrors: playerInstall },
  // The local app is opened via 127.0.0.1 / localhost in the browser.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // ESO folder search walks the player's Documents tree (outside the repo).
  // That is intentional — do not change the search. This only stops Turbopack
  // from treating those joins as "trace the whole project" and failing the exe.
  turbopack: {
    ignoreIssue: [
      {
        path: "**/src/lib/snapshot/locate.ts",
        title: /Dynamic filesystem access/,
      },
      {
        path: "**/src/lib/setup/**",
        title: /Dynamic filesystem access/,
      },
      {
        path: "**/src/lib/snapshot/auto.ts",
        title: /Dynamic filesystem access/,
      },
    ],
  },
};

export default nextConfig;
