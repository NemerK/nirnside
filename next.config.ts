import type { NextConfig } from "next";

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
