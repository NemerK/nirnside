/**
 * Copy NirnsideSnapshot + NirnsideCatalog into every ESO AddOns folder found
 * on this machine. Invoked by start-nirnside.cmd / .sh so the in-game addons
 * update even before the web app finishes booting.
 *
 *   npx tsx scripts/install-addons.ts
 */
import { installAddons } from "../src/lib/setup/install-addons";

function main() {
  const res = installAddons();
  if (res.addOnsDirs.length === 0) {
    console.log("[nirnside] No ESO AddOns folder found on this PC.");
    console.log("  Open Setup in the app and point it at Documents\\Elder Scrolls Online.");
    console.log("  (Not the Steam/game install — the Documents data folder.)");
    return;
  }

  console.log(`[nirnside] ESO AddOns folder(s):`);
  for (const dir of res.addOnsDirs) console.log(`  ${dir}`);

  for (const line of [...res.installed, ...res.updated, ...res.upToDate]) {
    console.log(`[nirnside] addon copied: ${line}`);
  }
  for (const err of res.errors) {
    console.error(`[nirnside] addon copy failed: ${err}`);
  }
  if (res.installed.length || res.updated.length || res.upToDate.length) {
    console.log("[nirnside] In game, /reloadui (or restart the client) so the new Lua loads.");
  }
}

main();
