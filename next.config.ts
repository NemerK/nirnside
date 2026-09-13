import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; keep it out of the bundler.
  serverExternalPackages: ["better-sqlite3"],
  // The local app is opened via 127.0.0.1 / localhost in the browser.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
