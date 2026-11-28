/**
 * Nirnside's own health check: is what it holds consistent with the game?
 *
 * Pure: it takes the catalog, the characters, the account and the addons'
 * versions, and returns one result per check. The database side gathers the
 * inputs (db/health.ts); Setup shows the results.
 *
 * Why: in November 2026 the catalog held the same line, set or star twice,
 * class lines without their class, and Champion stars under the wrong
 * constellation, and nothing said so until a page looked wrong. Each check
 * here is one of those mistakes, or a reason the data may be out of date,
 * stated plainly with what fixes it.
 */
import type { CatalogDomain } from "../catalog/schema";
import type { Character } from "../snapshot/schema";
import { catalogId } from "./catalog-ids";
import { findConstellation } from "./champion";

export type HealthStatus = "ok" | "note" | "problem";

export interface HealthCheck {
  id: string;
  title: string;
  status: HealthStatus;
  /** What was found, in a sentence. */
  detail: string;
  /** What fixes it, when something does. */
  fix?: string;
  /** Up to a handful of examples (names or ids). */
  examples?: string[];
}

export interface CatalogRowInput {
  domain: CatalogDomain;
  id: string;
  source: string;
  entry: Record<string, unknown> & { name: string };
}

export interface HealthInput {
  now: number;
  catalog: CatalogRowInput[];
  /** The catalog scan's patch label ("API101051"), when an in-game scan was read. */
  catalogPatch: string | null;
  characters: Character[];
  /** From the latest save. */
  account: { apiVersion: number | null; lastSnapshot: number | null } | null;
  /** Bag items: whether each has a place (an inventory tab). */
  items: { name: string; placed: boolean }[];
  /** The highest API version the addons Nirnside ships declare. */
  addonApiVersion: number | null;
}

const fold = (s: string) => s.trim().toLowerCase().replace(/['’]/g, "");
const examples = (list: string[]) => (list.length ? list.slice(0, 5) : undefined);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const DAY = 86_400;

/** The fields the newest snapshot addon writes; a save without them came from an older one. */
function savedByCurrentAddon(c: Character): boolean {
  return c.riding !== undefined || c.buffs !== undefined || c.backpack !== undefined;
}

export function checkHealth(input: HealthInput): HealthCheck[] {
  const out: HealthCheck[] = [];
  const { catalog } = input;

  // 1. Every catalog row under its one id.
  const offId = catalog.filter((r) => {
    const want = catalogId(r.domain, { id: r.id, name: r.entry.name, className: (r.entry.className as string | null) ?? null });
    return want !== r.id;
  });
  out.push(
    offId.length
      ? {
          id: "catalog-ids",
          title: "Catalog ids",
          status: "problem",
          detail: `${plural(offId.length, "catalog row")} under an id of its own making.`,
          fix: "Restart Nirnside: it files every row under its one id at start.",
          examples: examples(offId.map((r) => r.id)),
        }
      : { id: "catalog-ids", title: "Catalog ids", status: "ok", detail: "Every catalog row is filed under its one id." },
  );

  // 2. Nothing stored twice: one name per kind and place (an ability's line, a star's constellation, a Class Mastery tree's class).
  const seen = new Map<string, string[]>();
  for (const r of catalog) {
    const place =
      r.domain === "skill" ? String(r.entry.lineId ?? "") : r.domain === "skillline" ? String(r.entry.className ?? "") : "";
    const key = `${r.domain}|${fold(r.entry.name)}|${place}`;
    seen.set(key, [...(seen.get(key) ?? []), r.id]);
  }
  const twice = [...seen.entries()].filter(([, ids]) => ids.length > 1);
  out.push(
    twice.length
      ? {
          id: "catalog-duplicates",
          title: "Nothing stored twice",
          status: "problem",
          detail: `${plural(twice.length, "thing")} stored more than once in the catalog.`,
          fix: "Restart Nirnside to fold them together.",
          examples: examples(twice.map(([, ids]) => ids.join(" = "))),
        }
      : { id: "catalog-duplicates", title: "Nothing stored twice", status: "ok", detail: "Each line, ability, set and star is stored once." },
  );

  // 3. Every class line names its class.
  const classless = catalog.filter(
    (r) => r.domain === "skillline" && fold(String(r.entry.category ?? "")) === "class" && !r.entry.className,
  );
  out.push(
    classless.length
      ? {
          id: "class-lines",
          title: "Class lines",
          status: "problem",
          detail: `${plural(classless.length, "class line")} without its class; they would show in a classless group.`,
          fix: "Restart Nirnside; if it stays, run /nirncatalog in game with the latest addon.",
          examples: examples(classless.map((r) => r.entry.name)),
        }
      : { id: "class-lines", title: "Class lines", status: "ok", detail: "Every class line names its class." },
  );

  // 4. Every ability's line exists.
  const lineIds = new Set(catalog.filter((r) => r.domain === "skillline").map((r) => r.id));
  const orphans = catalog.filter((r) => r.domain === "skill" && !lineIds.has(String(r.entry.lineId ?? "")));
  out.push(
    orphans.length
      ? {
          id: "ability-lines",
          title: "Abilities and their lines",
          status: "problem",
          detail: `${plural(orphans.length, "ability", "abilities")} filed under a line the catalog doesn't have.`,
          fix: "Run /nirncatalog in game to rescan the skill lines.",
          examples: examples(orphans.map((r) => `${r.entry.name} → ${String(r.entry.lineId)}`)),
        }
      : { id: "ability-lines", title: "Abilities and their lines", status: "ok", detail: "Every ability sits under a line the catalog has." },
  );

  // 5. Champion stars under the constellation the saves show, and the scan able to tell slottable from passive.
  const saved = new Map<string, string>();
  for (const c of input.characters) {
    for (const d of c.champion ?? []) {
      const where = findConstellation(d.name);
      if (where) for (const s of d.stars ?? []) saved.set(fold(s.name), where);
    }
  }
  const stars = catalog.filter((r) => r.domain === "cp");
  const misplaced = stars.filter((r) => {
    const real = saved.get(fold(r.entry.name));
    return real && findConstellation(String(r.entry.category ?? "")) !== real;
  });
  const scanned = stars.filter((r) => r.source === "ingame");
  const allPassive = scanned.length > 0 && scanned.every((r) => r.entry.type === "passive");
  out.push(
    misplaced.length
      ? {
          id: "champion-stars",
          title: "Champion stars",
          status: "problem",
          detail: `${plural(misplaced.length, "star")} under a different constellation than your saves show.`,
          fix: "Restart Nirnside to move them; run /nirncatalog with the latest addon to rescan.",
          examples: examples(misplaced.map((r) => `${r.entry.name} (${String(r.entry.category)})`)),
        }
      : allPassive
        ? {
            id: "champion-stars",
            title: "Champion stars",
            status: "note",
            detail: "The catalog scan lists every star as passive; it came from an addon before Catalog 0.2.7.",
            fix: "Run /nirncatalog in game once. Stars your characters have points in are already right.",
          }
        : { id: "champion-stars", title: "Champion stars", status: "ok", detail: "Every star sits under its constellation." },
  );

  // 6. The catalog scanned on the game's current patch.
  const live = input.account?.apiVersion ?? null;
  const scannedApi = Number(/^API(\d+)$/.exec(input.catalogPatch ?? "")?.[1] ?? NaN);
  out.push(
    !input.catalogPatch || !Number.isFinite(scannedApi)
      ? {
          id: "catalog-patch",
          title: "Game catalog",
          status: "note",
          detail: "No in-game catalog scan yet: sets, skills and Champion Points come from Nirnside's own starter data.",
          fix: "In game, type /nirncatalog while AFK, then /reloadui.",
        }
      : live && scannedApi < live
        ? {
            id: "catalog-patch",
            title: "Game catalog",
            status: "note",
            detail: `The catalog was scanned on an older patch (API ${scannedApi}; the game is on ${live}).`,
            fix: "In game, type /nirncatalog while AFK, then /reloadui.",
          }
        : { id: "catalog-patch", title: "Game catalog", status: "ok", detail: `Scanned on the game's current patch (API ${scannedApi}).` },
  );

  // 7. The addons declare the game's API version, or the game lists them as out of date.
  if (live && input.addonApiVersion) {
    out.push(
      input.addonApiVersion < live
        ? {
            id: "addon-api",
            title: "Addons",
            status: "note",
            detail: `The Nirnside addons declare API ${input.addonApiVersion}; the game is on ${live}, so it lists them as out of date.`,
            fix: "Update Nirnside. Until then, tick \"Allow out of date add-ons\" in the game's add-on list.",
          }
        : { id: "addon-api", title: "Addons", status: "ok", detail: `The addons declare the game's API version (${live}).` },
    );
  }

  // 8. Characters saved by the current addon.
  const older = input.characters.filter((c) => !savedByCurrentAddon(c));
  out.push(
    older.length
      ? {
          id: "character-saves",
          title: "Character saves",
          status: "note",
          detail: `${plural(older.length, "character")} last saved by an older addon, so buffs, riding, skill points and bag space are unknown for them.`,
          fix: "Log each of them in once (or /reloadui on each).",
          examples: examples(older.map((c) => c.name)),
        }
      : { id: "character-saves", title: "Character saves", status: "ok", detail: "Every character was saved by the current addon." },
  );

  // 9. Every bag item in its place.
  const unplaced = input.items.filter((i) => !i.placed);
  out.push(
    unplaced.length
      ? {
          id: "item-places",
          title: "Items in their place",
          status: "note",
          detail: `${plural(unplaced.length, "item")} without an inventory tab; they were saved before the addon read the game's own tabs.`,
          fix: "Log in the character that holds them (or open the bank) once.",
          examples: examples([...new Set(unplaced.map((i) => i.name))]),
        }
      : { id: "item-places", title: "Items in their place", status: "ok", detail: "Every item is filed in its inventory tab." },
  );

  // 10. The latest save is recent.
  const last = input.account?.lastSnapshot ?? null;
  if (last) {
    const days = Math.floor((input.now - last) / DAY);
    out.push(
      days >= 7
        ? {
            id: "save-age",
            title: "Latest save",
            status: "note",
            detail: `The latest save is ${plural(days, "day")} old; everything shown is as of then.`,
            fix: "Log in, or /reloadui, with the addon on.",
          }
        : { id: "save-age", title: "Latest save", status: "ok", detail: days === 0 ? "Saved today." : `Saved ${plural(days, "day")} ago.` },
    );
  }
  return out;
}
