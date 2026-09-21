import "server-only";
import { getDb } from "./index";
import { archivedOwnerNames, isArchived } from "../snapshot/roster";
import type { Character } from "../snapshot/schema";
import { ensureRoleTables } from "./roles";

export interface SearchHit {
  kind: string; // Set, Skill line, Ability, Champion star, Grimoire, Script, Achievement, Character, Item
  name: string;
  detail?: string;
  href: string;
}

export interface SearchResults {
  catalog: SearchHit[];
  account: SearchHit[];
  total: number;
}

const DOMAIN_KIND: Record<string, string> = {
  set: "Set",
  skillline: "Skill line",
  skill: "Ability",
  cp: "Champion star",
  grimoire: "Grimoire",
  script: "Script",
  achievement: "Achievement",
};

function catalogHref(domain: string, id: string, json: string): string {
  switch (domain) {
    case "set":
      return `/encyclopedia/sets/${encodeURIComponent(id)}`;
    case "skillline":
      return `/encyclopedia/skills/${encodeURIComponent(id)}`;
    case "skill": {
      const lineId = safeParse(json)?.lineId as string | undefined;
      return lineId ? `/encyclopedia/skills/${encodeURIComponent(lineId)}` : "/encyclopedia/skills";
    }
    case "cp":
      return "/encyclopedia/champion-points";
    case "grimoire":
    case "script":
      return "/encyclopedia/scribing";
    case "achievement":
      return "/achievements";
    default:
      return "/encyclopedia";
  }
}

function safeParse(json: string): Record<string, unknown> | null {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function globalSearch(q: string, limit = 40): SearchResults {
  const term = q.trim();
  if (!term) return { catalog: [], account: [], total: 0 };
  const like = `%${term}%`;
  const db = getDb();
  ensureRoleTables();

  const catalogRows = db
    .prepare(
      "SELECT domain, id, name, category, json FROM catalog WHERE name LIKE ? ORDER BY name ASC LIMIT ?",
    )
    .all(like, limit) as { domain: string; id: string; name: string; category: string | null; json: string }[];

  const catalog: SearchHit[] = catalogRows.map((r) => ({
    kind: DOMAIN_KIND[r.domain] ?? r.domain,
    name: r.name,
    detail: r.category ?? undefined,
    href: catalogHref(r.domain, r.id, r.json),
  }));

  const account: SearchHit[] = [];

  const chars = db
    .prepare(
      `SELECT c.id, c.name, c.class, c.race, c.json,
         (SELECT GROUP_CONCAT(r.name, ' · ')
          FROM character_roles cr
          JOIN roles r ON r.id = cr.roleId
          WHERE cr.characterId = c.id) AS roleNames
       FROM characters c
       WHERE c.name LIKE ? OR c.class LIKE ? OR c.race LIKE ?
         OR EXISTS (
           SELECT 1 FROM character_roles cr
           JOIN roles r ON r.id = cr.roleId
           WHERE cr.characterId = c.id AND r.name LIKE ?
         )
       ORDER BY c.name ASC
       LIMIT 15`,
    )
    .all(like, like, like, like) as {
    id: string;
    name: string;
    class: string;
    race: string;
    json: string;
    roleNames: string | null;
  }[];
  for (const c of chars) {
    const full = safeParse(c.json) as Character | null;
    const archived = full ? isArchived(full) : false;
    const bits = [c.race, c.class, c.roleNames].filter(Boolean);
    account.push({
      kind: archived ? "Archived" : "Character",
      name: c.name,
      detail: archived ? `${bits.join(" · ")} · last known` : bits.join(" · ") || undefined,
      href: `/characters/${encodeURIComponent(c.id)}`,
    });
  }

  const allCharRows = db.prepare("SELECT json FROM characters").all() as { json: string }[];
  const hiddenOwners = archivedOwnerNames(
    allCharRows.map((r) => JSON.parse(r.json) as Character),
  );

  const items = db
    .prepare(
      "SELECT name, setName, location, ownerCharacter FROM items WHERE name LIKE ? OR setName LIKE ? LIMIT 40",
    )
    .all(like, like) as { name: string; setName: string | null; location: string; ownerCharacter: string | null }[];
  const seenItems = new Set<string>();
  for (const it of items) {
    if (it.ownerCharacter && hiddenOwners.has(it.ownerCharacter)) continue;
    if (seenItems.has(it.name)) continue;
    seenItems.add(it.name);
    if (seenItems.size > 15) break;
    account.push({
      kind: "Item",
      name: it.name,
      detail: it.setName ?? undefined,
      href: `/inventory?search=${encodeURIComponent(it.name)}`,
    });
  }

  return { catalog, account, total: catalog.length + account.length };
}
