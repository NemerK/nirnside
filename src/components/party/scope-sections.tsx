// The account-wide and across-character sections of Party, shared by the
// Account pages (inventory, sets, styles, houses, achievements) and the
// Across characters pages (dailies, crafting).
import Link from "next/link";
import type { VaultSection } from "@/components/party/areas";
import { Empty } from "@/components/party/module";
import { InventoryFilters } from "@/components/inventory-filters";
import { InventoryCategories } from "@/components/inventory-categories";
import { GroupedInventory } from "@/components/party/grouped-inventory";
import { groupItems } from "@/lib/party/inventory";
import { CurrencyTable } from "@/components/currency-table";
import { SetCatalogProvider } from "@/components/set-hover";
import { StickerbookGrid } from "@/components/stickerbook-grid";
import { AchievementsBoard } from "@/components/achievements-board";
import { DailiesBoard } from "@/components/dailies-board";
import { OutfitStylesGrid } from "@/components/outfit-styles-grid";
import { getDb } from "@/lib/db";
import {
  getAccount,
  getCompletedAchievementIds,
  getDataSource,
  getItemFacets,
  getItems,
  getOutfitStyles,
  getStickerbook,
  type ItemFilters,
} from "@/lib/db/queries";
import { getSets, setHref } from "@/lib/db/catalog-queries";
import { loadSetHover } from "@/lib/catalog/hover-sets";
import { withResolvedSet } from "@/lib/catalog/set-brief";
import { hrefForMythicOrSet } from "@/lib/collections/mythic-match";
import { tallyBagFilters } from "@/lib/inventory/bag-filters";
import { accountAlliancePoints, goldBreakdown } from "@/lib/snapshot/roster";
import { classColor } from "@/lib/classes";
import { formatNumber } from "@/lib/format";
import { currentUnix, dailyResetHourUtc, nextEsoResetAt, type EsoRegion } from "@/lib/dailies/day";
import { communityPledgesForUnix } from "@/lib/dailies/pledges";
import { presentAccountDailies } from "@/lib/dailies/present";
import { knownMotifKeys, presentMotifs, presentOutfitStyles, presentRecipeLists, presentResearch } from "@/lib/knowledge/present";
import { craftingCharacters, dailiesCharacters, roster } from "@/lib/party/data";
import { whoCanCraft } from "@/lib/party/craft";


const PAGE_SIZE = 100;

type Params = Record<string, string | string[] | undefined>;

function str(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0] || undefined;
  return v || undefined;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function withParams(path: string, sp: Params, patch: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const value = str(v);
    if (value) q.set(k, value);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v) q.set(k, v);
    else q.delete(k);
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/* ---------------- Inventory: filtered on the server, sent a page at a time ---------------- */

export function InventorySection({ sp }: { sp: Params }) {
  if (str(sp.view) === "currency") {
    const characters = roster();
    const account = safe(() => getAccount(), null);
    const bankGold = account?.currencies?.bankGold ?? 0;
    return (
      <>
        <p className="mb-4 text-[14px]">
          <Link href="/party/account/inventory" className="text-accent hover:underline">
            Back to items
          </Link>
        </p>
        <CurrencyTable
          characters={characters}
          bankGold={bankGold}
          gold={goldBreakdown({ characters, bankGold, legacyGold: account?.gold })}
          currencies={{
            ...(account?.currencies ?? {}),
            alliancePoints: accountAlliancePoints({ characters, legacyAlliancePoints: account?.currencies?.alliancePoints }),
          }}
        />
      </>
    );
  }

  const filters: ItemFilters = {
    search: str(sp.search),
    location: str(sp.location),
    quality: str(sp.quality),
    setName: str(sp.setName),
    trait: str(sp.trait),
    owner: str(sp.owner),
  };
  const bag = str(sp.bag);
  const sub = str(sp.sub);
  const page = Math.max(1, Number(str(sp.page) ?? 1) || 1);
  const hover = loadSetHover();
  let items = safe(() => getItems({ ...filters, setName: undefined }), []).map((it) => withResolvedSet(it, hover.known));
  if (filters.setName) items = items.filter((it) => it.setName === filters.setName);
  const untagged = items.filter((it) => !it.bagCategory).length;
  const tallied = tallyBagFilters(items);
  if (bag) items = items.filter((it) => it.bagCategory === bag);
  if (sub) items = items.filter((it) => it.bagSubtype === sub);
  const facets = safe(() => getItemFacets(), { locations: [], qualities: [], sets: [], traits: [], owners: [] });
  const groups = groupItems(items);
  const pages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shownGroups = groups.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const shown = shownGroups.map((g) => g.item);
  const characterIds = Object.fromEntries(roster().map((ch) => [ch.name, ch.id]));
  const mythics = safe(() => getAccount()?.mythics ?? [], []);
  const setHrefs: Record<string, string> = {};
  for (const it of shown) {
    if (!it.setName) continue;
    const key = `${it.setId ?? ""}|${it.setName}`;
    if (!setHrefs[key]) {
      setHrefs[key] = hrefForMythicOrSet(mythics, { name: it.setName, setId: it.setId }, setHref({ name: it.setName, setId: it.setId }));
    }
  }
  const totalCount = items.reduce((n, it) => n + it.count, 0);
  const sets = new Set(shown.map((it) => it.setName).filter(Boolean));

  return (
    <SetCatalogProvider sets={hover.briefs.filter((b) => sets.has(b.name))}>
      <div className="mb-3 space-y-3">
        <InventoryCategories counts={tallied.counts} labels={tallied.labels} untagged={untagged} />
        <InventoryFilters facets={facets} />
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[13px] text-fg-muted">
        <span>
          {formatNumber(groups.length)} kinds of item · {formatNumber(totalCount)} items in {formatNumber(items.length)} stacks
          {pages > 1 ? ` · showing ${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, groups.length)}` : ""}
        </span>
        <Link href="/party/account/inventory?view=currency" className="text-accent hover:underline">
          Currencies per character
        </Link>
      </div>
      {shown.length === 0 ? (
        <Empty>No items match. Clear a filter to see more.</Empty>
      ) : (
        <GroupedInventory groups={shownGroups} setHrefs={setHrefs} characterIds={characterIds} />
      )}
      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center gap-2 text-[14px]">
          {current > 1 ? (
            <Link href={withParams("/party/account/inventory", sp, { page: String(current - 1) })} className="rounded-lg border border-border px-3 py-1.5 text-fg hover:border-border-strong">
              Previous
            </Link>
          ) : null}
          <span className="px-2 text-fg-muted">
            Page {current} of {pages}
          </span>
          {current < pages ? (
            <Link href={withParams("/party/account/inventory", sp, { page: String(current + 1) })} className="rounded-lg border border-border px-3 py-1.5 text-fg hover:border-border-strong">
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </SetCatalogProvider>
  );
}

/* ---------------- Set collection: one category at a time ---------------- */

export function SetsSection({ sp }: { sp: Params }) {
  const cats = safe(
    () =>
      getDb()
        .prepare("SELECT category, COUNT(*) AS sets, SUM(collected) AS collected, SUM(total) AS total FROM stickerbook GROUP BY category ORDER BY category")
        .all() as { category: string; sets: number; collected: number; total: number }[],
    [],
  );
  if (cats.length === 0) return <Empty>Your set collection fills in after a logout with the addon on.</Empty>;
  const chosen = cats.find((c) => c.category === str(sp.cat))?.category ?? cats[0].category;
  const inCategory = safe(() => getStickerbook(), []).filter((s) => s.category === chosen);
  // Large categories (Overland, Dungeon…) split by zone, so one page never
  // carries hundreds of sets and thousands of pieces.
  const subs = [...new Set(inCategory.map((s) => s.subcategory).filter((x): x is string => !!x))].sort();
  const split = inCategory.length > 30 && subs.length > 1;
  const sub = split ? (subs.find((x) => x === str(sp.sub)) ?? subs[0]) : null;
  const pool = sub ? inCategory.filter((s) => s.subcategory === sub) : inCategory;
  // Whatever is still large after the zone split is shown a page at a time.
  const SETS_PER_PAGE = 60;
  const setPages = pool.length > SETS_PER_PAGE ? Math.ceil(pool.length / SETS_PER_PAGE) : 1;
  const setPage = Math.min(setPages, Math.max(1, Number(str(sp.page) ?? 1) || 1));
  const sets = setPages > 1 ? pool.slice((setPage - 1) * SETS_PER_PAGE, setPage * SETS_PER_PAGE) : pool;
  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {cats.map((c) => (
          <Link
            key={c.category}
            href={`/party/account/sets?cat=${encodeURIComponent(c.category)}`}
            aria-current={c.category === chosen ? "page" : undefined}
            className={`shrink-0 rounded-xl border px-3 py-2 text-[13px] ${
              c.category === chosen ? "border-accent bg-accent-soft text-fg" : "border-border text-fg-muted hover:text-fg"
            }`}
          >
            {c.category}
            <span className="ml-2 tabular-nums text-fg-subtle">
              {c.collected}/{c.total}
            </span>
          </Link>
        ))}
      </div>
      {split ? (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {subs.map((x) => (
            <Link
              key={x}
              href={`/party/account/sets?cat=${encodeURIComponent(chosen)}&sub=${encodeURIComponent(x)}`}
              aria-current={x === sub ? "page" : undefined}
              className={`rounded-lg px-2.5 py-1 text-[13px] ${x === sub ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"}`}
            >
              {x}
            </Link>
          ))}
        </div>
      ) : null}
      <StickerbookGrid
        contained
        compact
        mythics={safe(() => getAccount()?.mythics ?? [], [])}
        sets={sets.map((s) => ({ ...s, href: setHref({ name: s.name, setId: s.setId }) }))}
      />
      {setPages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center gap-2 text-[14px]">
          {setPage > 1 ? (
            <Link
              href={withParams("/party/account/sets", sp, { cat: chosen, sub: sub ?? undefined, page: String(setPage - 1) })}
              className="rounded-lg border border-border px-3 py-1.5 text-fg hover:border-border-strong"
            >
              Previous
            </Link>
          ) : null}
          <span className="px-2 text-fg-muted">
            Sets {(setPage - 1) * SETS_PER_PAGE + 1}–{Math.min(setPage * SETS_PER_PAGE, pool.length)} of {pool.length}
          </span>
          {setPage < setPages ? (
            <Link
              href={withParams("/party/account/sets", sp, { cat: chosen, sub: sub ?? undefined, page: String(setPage + 1) })}
              className="rounded-lg border border-border px-3 py-1.5 text-fg hover:border-border-strong"
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}

/* ---------------- Crafting: account totals per character, and who can craft a set ---------------- */

export function CraftingSection({ sp }: { sp: Params }) {
  const characters = craftingCharacters().filter((c) => c.lastSeen != null);
  const crafted = safe(() => getSets({ category: "Crafted" }), []).map(({ entry }) => entry);
  const chosen = crafted.find((s) => s.name === str(sp.set)) ?? crafted[0] ?? null;
  const trait = str(sp.trait) ?? null;
  const needed = chosen?.traitsNeeded ?? 0;
  const rows = chosen
    ? whoCanCraft(
        characters.map((c) => ({ id: c.id, name: c.name, className: c.class, research: c.research })),
        needed,
        trait,
      )
    : [];
  const traitNames = [
    ...new Set(characters.flatMap((c) => c.research.crafts.flatMap((cr) => cr.lines.flatMap((l) => l.traits.map((t) => t.name))))),
  ].sort();

  return (
    <div className="space-y-8">
      <section className="party-module px-6 py-5">
        <h2 className="font-display text-[26px] text-fg">Who can craft it?</h2>
        <form method="get" className="mt-3 flex flex-wrap items-end gap-3 text-[14px]">
          <label className="flex flex-col gap-1">
            <span className="text-[12.5px] text-fg-subtle">Crafted set</span>
            <select name="set" defaultValue={chosen?.name} className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-fg">
              {crafted.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                  {s.traitsNeeded ? ` — ${s.traitsNeeded} traits` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12.5px] text-fg-subtle">Trait</span>
            <select name="trait" defaultValue={trait ?? ""} className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-fg">
              <option value="">Any trait</option>
              {traitNames.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 font-medium text-accent-fg">
            Check
          </button>
        </form>
        {!chosen ? (
          <p className="mt-4 text-sm text-fg-muted">The catalog has no crafted sets yet. An in-game catalog scan fills them in.</p>
        ) : needed === 0 ? (
          <p className="mt-4 text-sm text-fg-muted">
            The catalog doesn&apos;t say how many traits {chosen.name} needs yet, so Nirnside won&apos;t guess.
          </p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-fg-muted">No research captured yet.</p>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-[14px]">
              <thead>
                <tr className="text-left text-[12.5px] text-fg-subtle">
                  <th className="pb-2 font-normal">Piece</th>
                  <th className="pb-2 font-normal">Can make it now</th>
                  <th className="pb-2 font-normal">Closest otherwise</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={`${r.craft}-${r.line}`}>
                    <td className="py-2 pr-4 text-fg">
                      {r.line} <span className="text-[12px] text-fg-subtle">{r.craft}</span>
                    </td>
                    <td className="py-2 pr-4">
                      {r.can.length === 0 ? (
                        <span className="text-fg-subtle">Nobody yet</span>
                      ) : (
                        r.can.map((c, i) => (
                          <span key={c.id}>
                            {i > 0 ? ", " : null}
                            <span style={{ color: classColor(c.className) }}>{c.name}</span>
                            <span className="text-fg-subtle"> ({c.known})</span>
                          </span>
                        ))
                      )}
                    </td>
                    <td className="py-2 text-fg-muted">
                      {r.closest ? `${r.closest.name}, ${r.closest.missing} short` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[12.5px] text-fg-subtle">
              {chosen.name} needs {needed} traits researched on the piece{trait ? `, including ${trait}` : ""}. Numbers in brackets are
              traits known.
            </p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-[26px] text-fg">Every character</h2>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-[14px]">
            <thead>
              <tr className="bg-surface text-left text-[12.5px] text-fg-subtle">
                <th className="px-4 py-2.5 font-normal">Character</th>
                <th className="px-4 py-2.5 font-normal">Traits</th>
                <th className="px-4 py-2.5 font-normal">Motif chapters</th>
                <th className="px-4 py-2.5 font-normal">Recipes</th>
                <th className="px-4 py-2.5 font-normal">Plans</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {characters.map((c) => {
                const r = presentResearch(c.research);
                const m = presentMotifs(c.motifs);
                const rec = presentRecipeLists(c.recipeLists, "provisioning");
                const pl = presentRecipeLists(c.recipeLists, "furnishing");
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/party/c/${encodeURIComponent(c.id)}/crafting`} className="hover:underline" style={{ color: classColor(c.class) }}>
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-fg-muted">{r.total ? `${r.known}/${r.total}` : "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums text-fg-muted">{m.total ? `${m.known}/${m.total}` : "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums text-fg-muted">{rec.total ? `${rec.known}/${rec.total}` : "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums text-fg-muted">{pl.total ? `${pl.known}/${pl.total}` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ---------------- The rest reuse the existing boards ---------------- */

export function DailiesSection() {
  const account = safe(() => getAccount(), null);
  const region: EsoRegion = account?.region === "NA" ? "NA" : "EU";
  const now = currentUnix();
  const isSample = safe(() => getDataSource(), null)?.kind === "sample";
  const todayPledges = communityPledgesForUnix(now, region);
  const rows = presentAccountDailies(dailiesCharacters(), now, { treatAsFresh: isSample, todayPledges, region });
  return (
    <DailiesBoard
      rows={rows}
      resetAt={nextEsoResetAt(now, region)}
      todayPledges={todayPledges}
      resetLabel={`${region} ${String(dailyResetHourUtc(region)).padStart(2, "0")}:00 UTC`}
    />
  );
}

export function StylesSection({ sp }: { sp: Params }) {
  const motifKeys = new Set<string>();
  for (const c of craftingCharacters()) for (const key of knownMotifKeys(c.motifs)) motifKeys.add(key);
  return (
    <OutfitStylesGrid
      contained
      presented={presentOutfitStyles(safe(() => getOutfitStyles(), []))}
      motifKeys={[...motifKeys]}
      initialQuery={str(sp.q)}
    />
  );
}

export function HousesSection() {
  const houses = safe(() => getAccount()?.houses ?? [], []);
  if (houses.length === 0) return <Empty>No houses owned. House banks are never collected.</Empty>;
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {houses.map((h) => (
        <li key={h.collectibleId} className="party-module px-5 py-4">
          <p className="font-display text-[22px] text-fg">{h.name}</p>
          <p className="mt-1 text-[14px] text-fg-muted">
            {h.location ?? "Location unknown"}
            {h.primary ? <span className="ml-2 text-accent">Primary residence</span> : null}
          </p>
          <a href={`/houses/${h.collectibleId}`} className="mt-3 inline-block text-[13px] text-accent hover:underline">
            Photos
          </a>
        </li>
      ))}
    </ul>
  );
}

export const SECTION_TITLES: Record<Exclude<VaultSection, "">, { title: string; lead: string }> = {
  inventory: { title: "Inventory", lead: "Every bag on the account: worn, backpacks, bank, subscriber bank and craft bag." },
  sets: { title: "Set collection", lead: "Collected and missing set pieces, one category at a time." },
  achievements: { title: "Achievements", lead: "Trial, dungeon and arena clears, as the game reports them." },
  dailies: { title: "Dailies", lead: "Randoms, writs, pledges and zone dailies for every character, against the daily reset." },
  crafting: { title: "Crafting", lead: "Who can make what, and every character's research, motifs and recipes." },
  styles: { title: "Outfit styles", lead: "Styles unlocked on the account, as the game's Collections tree lists them." },
  houses: { title: "Houses", lead: "Houses this account owns. House banks are never collected." },
};


export function AchievementsSection() {
  return <AchievementsBoard completedIds={safe(() => getCompletedAchievementIds(), [])} />;
}
