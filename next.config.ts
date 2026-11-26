import type { NextConfig } from "next";
import { pruneStale } from "./scripts/prune-stale.mjs";

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

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; keep it out of the bundler.
  serverExternalPackages: ["better-sqlite3"],
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
