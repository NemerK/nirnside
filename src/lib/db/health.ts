import "server-only";

import { getDb } from "./index";
import { getAccount, getCharactersFull } from "./queries";
import { CatalogDomain } from "../catalog/schema";
import { checkHealth, type CatalogRowInput, type HealthCheck } from "../game/health";
import { bundledAddonManifest } from "../setup/install-addons";

/** Nirnside's health check on what it holds now (game/health.ts). */
export function dataHealth(now: number = Math.floor(Date.now() / 1000)): HealthCheck[] {
  const db = getDb();
  const catalog: CatalogRowInput[] = [];
  for (const r of db.prepare("SELECT domain, id, source, json FROM catalog").all() as {
    domain: string;
    id: string;
    source: string;
    json: string;
  }[]) {
    const domain = CatalogDomain.safeParse(r.domain);
    if (domain.success) catalog.push({ domain: domain.data, id: r.id, source: r.source, entry: JSON.parse(r.json) });
  }
  // The scan's patch, from the scanned rows themselves: the newest API label any of them carries.
  const scanned = (db.prepare("SELECT DISTINCT patch FROM catalog WHERE source = 'ingame' AND patch LIKE 'API%'").all() as {
    patch: string;
  }[])
    .map((r) => Number(r.patch.slice(3)))
    .filter(Number.isFinite);
  const account = getAccount();
  const items = (db.prepare("SELECT name, json_extract(json, '$.bagCategory') AS tab FROM items").all() as {
    name: string;
    tab: string | null;
  }[]).map((i) => ({ name: i.name, placed: !!i.tab }));
  const apis = ["NirnsideSnapshot", "NirnsideCatalog"]
    .map((a) => bundledAddonManifest(a).apiVersion)
    .filter((v): v is number => v != null);
  return checkHealth({
    now,
    catalog,
    catalogPatch: scanned.length ? `API${Math.max(...scanned)}` : null,
    characters: getCharactersFull(),
    account: account ? { apiVersion: account.apiVersion ?? null, lastSnapshot: account.lastSnapshot ?? null } : null,
    items,
    addonApiVersion: apis.length ? Math.min(...apis) : null,
  });
}
