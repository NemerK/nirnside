import "server-only";
import { getDb } from "./index";

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
    .prepare("SELECT id, name, class, race FROM characters WHERE name LIKE ? LIMIT 10")
    .all(like) as { id: string; name: string; class: string; race: string }[];
  for (const c of chars) {
    account.push({ kind: "Character", name: c.name, detail: `${c.race} ${c.class}`, href: `/characters/${encodeURIComponent(c.id)}` });
  }

  const items = db
    .prepare(
      "SELECT name, setName, location FROM items WHERE name LIKE ? OR setName LIKE ? GROUP BY name LIMIT 15",
    )
    .all(like, like) as { name: string; setName: string | null; location: string }[];
  for (const it of items) {
    account.push({
      kind: "Item",
      name: it.name,
      detail: it.setName ?? undefined,
      href: `/inventory?search=${encodeURIComponent(it.name)}`,
    });
  }

  return { catalog, account, total: catalog.length + account.length };
}
