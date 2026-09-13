import "server-only";
import { getDb } from "./index";
import type {
  CatalogGrimoire,
  CatalogScript,
  CatalogSet,
  CatalogSkill,
  CatalogSkillLine,
  CatalogCPStar,
  CatalogDomain,
  CatalogSource,
} from "../catalog/schema";

interface Filters {
  search?: string;
  category?: string;
}

interface CatalogRow<T> {
  entry: T;
  source: CatalogSource;
}

function query<T>(domain: CatalogDomain, filters: Filters = {}): CatalogRow<T>[] {
  const where: string[] = ["domain = @domain"];
  const params: Record<string, unknown> = { domain };
  if (filters.search) {
    where.push("name LIKE @search");
    params.search = `%${filters.search}%`;
  }
  if (filters.category) {
    where.push("category = @category");
    params.category = filters.category;
  }
  const rows = getDb()
    .prepare(`SELECT json, source FROM catalog WHERE ${where.join(" AND ")} ORDER BY name ASC LIMIT 5000`)
    .all(params) as { json: string; source: CatalogSource }[];
  return rows.map((r) => ({ entry: JSON.parse(r.json) as T, source: r.source }));
}

function one<T>(domain: CatalogDomain, id: string): CatalogRow<T> | null {
  const row = getDb()
    .prepare("SELECT json, source FROM catalog WHERE domain = ? AND id = ?")
    .get(domain, id) as { json: string; source: CatalogSource } | undefined;
  return row ? { entry: JSON.parse(row.json) as T, source: row.source } : null;
}

function byName<T>(domain: CatalogDomain, name: string): CatalogRow<T> | null {
  const row = getDb()
    .prepare("SELECT json, source FROM catalog WHERE domain = ? AND name = ? COLLATE NOCASE LIMIT 1")
    .get(domain, name) as { json: string; source: CatalogSource } | undefined;
  return row ? { entry: JSON.parse(row.json) as T, source: row.source } : null;
}

function categories(domain: CatalogDomain): string[] {
  return (
    getDb()
      .prepare("SELECT DISTINCT category FROM catalog WHERE domain = ? AND category IS NOT NULL ORDER BY category")
      .all(domain) as { category: string }[]
  ).map((r) => r.category);
}

export function catalogCount(domain: CatalogDomain): number {
  const row = getDb().prepare("SELECT COUNT(*) c FROM catalog WHERE domain = ?").get(domain) as { c: number };
  return row.c;
}

// Domain-typed helpers
export const getSets = (f?: Filters) => query<CatalogSet>("set", f);
export const getSet = (id: string) => one<CatalogSet>("set", id);
export const getSetByName = (name: string) => byName<CatalogSet>("set", name);
export const setCategories = () => categories("set");

export const getSkillLines = (f?: Filters) => query<CatalogSkillLine>("skillline", f);
export const getSkillLine = (id: string) => one<CatalogSkillLine>("skillline", id);
export const getSkillLineByName = (name: string) => byName<CatalogSkillLine>("skillline", name);
export const skillLineCategories = () => categories("skillline");
export const getSkillsForLine = (lineId: string) => query<CatalogSkill>("skill", { category: lineId });
export const getSkillByName = (name: string) => byName<CatalogSkill>("skill", name);

export const getCPStars = (f?: Filters) => query<CatalogCPStar>("cp", f);
export const getCPStarByName = (name: string) => byName<CatalogCPStar>("cp", name);
export const cpCategories = () => categories("cp");

export const getGrimoires = (f?: Filters) => query<CatalogGrimoire>("grimoire", f);
export const getGrimoire = (id: string) => one<CatalogGrimoire>("grimoire", id);
export const getScripts = (f?: Filters) => query<CatalogScript>("script", f);
export const getScript = (id: string) => one<CatalogScript>("script", id);

export type { CatalogRow };
