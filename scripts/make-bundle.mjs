// Assemble the ready-built app the Windows launcher downloads.
// Run after `NIRNSIDE_BUNDLE=1 next build`; writes dist/bundle/.
//
//   node scripts/make-bundle.mjs <commit-sha>
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sha = (process.argv[2] || process.env.GITHUB_SHA || "").trim();
if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
  console.error("usage: node scripts/make-bundle.mjs <commit-sha>");
  process.exit(1);
}
const standalone = join(root, ".next", "standalone");
if (!existsSync(join(standalone, "server.js"))) {
  console.error("No .next/standalone/server.js. Build with NIRNSIDE_BUNDLE=1 first.");
  process.exit(1);
}

const out = join(root, "dist", "bundle");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// The traced server, minus anything that must never ship: the git history and
// any player data that happened to be on the build machine.
cpSync(standalone, out, { recursive: true });
for (const junk of [".git", "data", ".cursor", ".github", "installer", "src"]) {
  rmSync(join(out, junk), { recursive: true, force: true });
}

// What the standalone trace does not copy: browser assets and the app's own
// read-only files that are looked up by path at runtime.
const copies = [
  [".next/static", ".next/static"],
  ["public", "public"],
  ["addon", "addon"],
  ["data/catalog", "data/catalog"],
  ["data/icons", "data/icons"],
  ["data/sample", "data/sample"],
  ["nirnside.ico", "nirnside.ico"],
  ["nirnside-channel.json", "nirnside-channel.json"],
];
for (const [from, to] of copies) {
  const src = join(root, from);
  if (existsSync(src)) cpSync(src, join(out, to), { recursive: true });
}

const info = { sha, node: process.version, builtAt: new Date().toISOString() };
writeFileSync(join(out, "nirnside-build.json"), JSON.stringify(info, null, 2) + "\n");
// The app's own update check reads this (src/lib/setup/update-info.ts).
writeFileSync(
  join(out, ".nirnside-revision"),
  JSON.stringify({ sha, source: "zip", ref: "main", at: info.builtAt }, null, 2) + "\n",
);

// Guard: nothing that looks like player data may ship.
function walk(dir) {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (/\.db(-wal|-shm)?$/i.test(ent.name) || /^NirnsideSnapshot\.lua$|^NirnsideCatalog\.lua$/i.test(ent.name) && !full.includes(join("addon", ""))) {
      console.error(`Refusing to ship ${full}`);
      process.exit(1);
    }
  }
}
walk(out);
console.log(`bundle ${sha.slice(0, 7)} for Node ${process.version} → ${out}`);
