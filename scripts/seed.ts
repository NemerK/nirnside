/**
 * Seed the local DB with the bundled sample account AND the reference catalog,
 * so the whole app (account view + encyclopedia) is populated for a preview.
 */
import { resolve } from "node:path";
import { loadSnapshotFromFile } from "../src/lib/snapshot/load";
import { importSnapshot } from "../src/lib/db/import";
import { loadReferenceCatalog } from "../src/lib/catalog/load";

function main() {
  const sample = resolve("data/sample/Nirnside.lua");
  const snap = loadSnapshotFromFile(sample);
  const r = importSnapshot(snap);
  console.log(`Account: ${snap.displayName} — ${r.characters} chars, ${r.items} items, ${r.sets} sets`);

  const cat = loadReferenceCatalog();
  console.log(`Catalog: ${cat.files} reference files — ` + Object.entries(cat.counts).map(([k, v]) => `${v} ${k}`).join(", "));
}

main();
