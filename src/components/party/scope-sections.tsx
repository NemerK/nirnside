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
import { CollectionSearch } from "@/components/party/collection-search";
import { categoryTree, searchSets } from "@/lib/party/set-collection";
import { AchievementsBoard } from "@/components/achievements-board";
import { DailiesBoard } from "@/components/dailies-board";
import { OutfitStylesGrid } from "@/components/outfit-styles-grid";
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
import { craftCoverage, whoCanCraft, type CraftRow } from "@/lib/party/craft";
import { CraftCheckControls } from "@/components/party/craft-check-controls";
import { Fragment } from "react";
import { Check } from "lucide-react";


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
          <Link href="/party/inventory" className="text-accent hover:underline">
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
        <Link href="/party/inventory?view=currency" className="text-accent hover:underline">
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
            <Link href={withParams("/party/inventory", sp, { page: String(current - 1) })} className="rounded-lg border border-border px-3 py-1.5 text-fg hover:border-border-strong">
              Previous
            </Link>
          ) : null}
          <span className="px-2 text-fg-muted">
            Page {current} of {pages}
          </span>
          {current < pages ? (
            <Link href={withParams("/party/inventory", sp, { page: String(current + 1) })} className="rounded-lg border border-border px-3 py-1.5 text-fg hover:border-border-strong">
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
  const all = safe(() => getStickerbook(), []);
  if (all.length === 0) return <Empty>Your set collection fills in after a logout with the addon on.</Empty>;
  const tree = categoryTree(all);
  const q = (str(sp.q) ?? "").trim();
  const mythics = safe(() => getAccount()?.mythics ?? [], []);
  const withHref = (list: typeof all) => list.map((s) => ({ ...s, href: setHref({ name: s.name, setId: s.setId }) }));
  const search = <CollectionSearch placeholder="Search every set or piece" initial={q} />;

  // Searching looks through every category, so a set is found wherever it lives.
  const found = q ? searchSets(all, q) : [];
  const hits = new Map<string, number>();
  for (const s of found) hits.set(s.category || "Other", (hits.get(s.category || "Other") ?? 0) + 1);

  const chosen = q && hits.size > 0
    ? [...hits.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : (tree.find((c) => c.name === str(sp.cat))?.name ?? tree[0].name);
  const inCategory = all.filter((s) => (s.category || "Other") === chosen);
  // Large categories (Overland, Dungeons…) open one zone at a time.
  const node = tree.find((c) => c.name === chosen)!;
  const split = inCategory.length > 30 && node.subs.length > 1;
  const sub = split ? (node.subs.find((x) => x.name === str(sp.sub))?.name ?? node.subs[0].name) : null;
  const pool = sub ? inCategory.filter((s) => s.subcategory === sub) : inCategory;
  const SETS_PER_PAGE = 60;
  const setPages = pool.length > SETS_PER_PAGE ? Math.ceil(pool.length / SETS_PER_PAGE) : 1;
  const setPage = Math.min(setPages, Math.max(1, Number(str(sp.page) ?? 1) || 1));
  const sets = setPages > 1 ? pool.slice((setPage - 1) * SETS_PER_PAGE, setPage * SETS_PER_PAGE) : pool;
  const catHref = (cat: string, subName?: string) =>
    `/party/collections?tab=sets&cat=${encodeURIComponent(cat)}${subName ? `&sub=${encodeURIComponent(subName)}` : ""}`;

  return (
    <div className="grid gap-5 lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <nav
        aria-label="Set categories"
        className="max-h-64 overflow-y-auto pr-1 lg:sticky lg:top-4 lg:max-h-[calc(100vh-8rem)] lg:self-start"
      >
        <ul className="space-y-0.5">
          {tree.map((c) => {
            const on = c.name === chosen && !q;
            const n = hits.get(c.name) ?? 0;
            const done = c.total > 0 && c.collected === c.total;
            const pct = c.total > 0 ? Math.round((c.collected / c.total) * 100) : 0;
            return (
              <li key={c.name}>
                <Link
                  href={catHref(c.name)}
                  aria-current={on ? "page" : undefined}
                  className={`block rounded-lg px-3 py-2 ${
                    on ? "bg-accent-soft text-fg" : q && n === 0 ? "text-fg-subtle/60 hover:text-fg-muted" : "text-fg-muted hover:bg-surface-2/60 hover:text-fg"
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="truncate">{c.name}</span>
                    {q ? (
                      n > 0 ? <span className="shrink-0 rounded bg-accent-soft px-1.5 text-[11px] text-fg">{n}</span> : null
                    ) : (
                      <span className={`shrink-0 text-[11px] tabular-nums ${done ? "text-ok" : "text-fg-subtle"}`}>
                        {c.collected}/{c.total}
                      </span>
                    )}
                  </span>
                  {q ? null : (
                    <span className="mt-1.5 block h-[3px] rounded-full bg-meter-track" aria-hidden>
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${pct}%`, background: done ? "var(--ok)" : "var(--meter)" }}
                      />
                    </span>
                  )}
                </Link>
                {on && split ? (
                  <ul className="mb-1 ml-3 mt-0.5 border-l border-border/70 pl-2">
                    {c.subs.map((x) => (
                      <li key={x.name}>
                        <Link
                          href={catHref(c.name, x.name)}
                          aria-current={x.name === sub ? "page" : undefined}
                          className={`flex items-baseline justify-between gap-2 rounded-md px-2 py-1 text-[12px] ${
                            x.name === sub ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"
                          }`}
                        >
                          <span className="truncate">{x.name}</span>
                          <span className={`shrink-0 tabular-nums ${x.collected === x.total ? "text-ok" : "text-fg-subtle"}`}>
                            {x.collected}/{x.total}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="min-w-0">
        {q ? (
          found.length === 0 ? (
            <>
              <div className="mb-3 flex">{search}</div>
              <Empty>
                No set or piece in your collection matches “{q}”. Check the spelling, or search the{" "}
                <Link href={`/party/library/sets?search=${encodeURIComponent(q)}`} className="text-accent hover:underline">
                  Library
                </Link>
                .
              </Empty>
            </>
          ) : (
            <StickerbookGrid
              contained
              compact
              grouped
              searchSlot={search}
              heading={`Matching “${q}”`}
              mythics={mythics}
              sets={withHref(found.slice(0, 60))}
            />
          )
        ) : (
          <>
            <StickerbookGrid
              contained
              compact
              searchSlot={search}
              heading={sub ? `${chosen} › ${sub}` : chosen}
              mythics={mythics}
              sets={withHref(sets)}
            />
            {setPages > 1 ? (
              <nav aria-label="Pages" className="mt-4 flex flex-wrap items-center gap-2 text-[14px]">
                {setPage > 1 ? (
                  <Link
                    href={withParams("/party/collections", sp, { cat: chosen, sub: sub ?? undefined, page: String(setPage - 1) })}
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
                    href={withParams("/party/collections", sp, { cat: chosen, sub: sub ?? undefined, page: String(setPage + 1) })}
                    className="rounded-lg border border-border px-3 py-1.5 text-fg hover:border-border-strong"
                  >
                    Next
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- Crafting: account totals per character, and who can craft a set ---------------- */

/**
 * Pieces down the side, characters across, like the Planner: a tick where a
 * character can make the piece now, otherwise traits known out of needed.
 * Above it, the answer most people came for: who can make the whole set.
 */
function CraftGrid({
  rows,
  characters,
  needed,
  trait,
  setName,
}: {
  rows: CraftRow[];
  characters: { id: string; name: string; class: string }[];
  needed: number;
  trait: string | null;
  setName: string;
}) {
  const people = characters.filter((c) => rows.some((r) => r.cells[c.id]));
  const cover = craftCoverage(rows, people.map((c) => c.id));
  people.sort((a, b) => (cover.get(b.id)?.ok ?? 0) - (cover.get(a.id)?.ok ?? 0) || a.name.localeCompare(b.name));
  const whole = people.filter((c) => {
    const v = cover.get(c.id);
    return v && v.total > 0 && v.ok === v.total;
  });
  const best = people[0];
  const bestCover = best ? cover.get(best.id) : undefined;
  const crafts = [...new Set(rows.map((r) => r.craft))];
  const nobody = rows.filter((r) => r.can.length === 0);

  return (
    <div className="mt-4">
      <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-[14px]">
        {whole.length > 0 ? (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-fg-muted">Can make every piece{trait ? ` in ${trait}` : ""}:</span>
            {whole.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-0.5 text-fg">
                <span className="h-2 w-2 rounded-full" style={{ background: classColor(c.class) ?? "var(--border)" }} aria-hidden />
                {c.name}
              </span>
            ))}
          </p>
        ) : (
          <p className="text-fg-muted">
            Nobody can make every piece yet.
            {best && bestCover ? (
              <>
                {" "}
                Closest is <span className="text-fg">{best.name}</span>, with {bestCover.ok} of {bestCover.total} pieces.
              </>
            ) : null}
          </p>
        )}
        {nobody.length > 0 ? (
          <p className="mt-1.5 text-[13px] text-fg-subtle">
            No one can make {nobody.map((r) => r.line).join(", ")} yet.
          </p>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table
          className="table-fixed border-separate border-spacing-0"
          style={{ width: `calc(12rem + ${people.length} * 3.5rem)` }}
        >
          <colgroup>
            <col style={{ width: "12rem" }} />
            {people.map((c) => (
              <col key={c.id} style={{ width: "3.5rem" }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 border-b border-border bg-surface pb-2 pr-3 text-left align-bottom text-[12px] font-normal text-fg-subtle">
                {rows.length} pieces · {needed} traits each
              </th>
              {people.map((c) => {
                const v = cover.get(c.id);
                const full = v && v.total > 0 && v.ok === v.total;
                return (
                  <th key={c.id} className="border-b border-border px-0.5 pb-2 align-bottom font-normal" title={`${c.name} · ${c.class}\nCan make ${v?.ok ?? 0} of ${v?.total ?? 0} pieces`}>
                    <span className="mx-auto flex flex-col items-center gap-1.5">
                      <span className="max-h-32 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-fg [writing-mode:vertical-rl] rotate-180">
                        {c.name}
                      </span>
                      <span className="h-1 w-5 rounded-full" style={{ background: classColor(c.class) ?? "var(--border)" }} aria-hidden />
                      <span className={`text-[11px] tabular-nums ${full ? "text-ok" : "text-fg-muted"}`}>
                        {v?.ok ?? 0}/{v?.total ?? 0}
                      </span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {crafts.map((craft) => (
              <Fragment key={craft}>
                <tr>
                  <th colSpan={people.length + 1} className="sticky left-0 border-b border-border/60 bg-surface-2/40 px-0 py-1.5 text-left text-[12px] font-normal text-fg">
                    {craft}
                  </th>
                </tr>
                {rows
                  .filter((r) => r.craft === craft)
                  .map((r) => (
                    <tr key={`${r.craft}-${r.line}`} className="group/row hover:bg-surface-2/30">
                      <th scope="row" className="sticky left-0 z-10 truncate border-b border-border/40 bg-surface py-1.5 pr-3 text-left text-[13px] font-normal text-fg group-hover/row:bg-surface-2">
                        {r.line}
                      </th>
                      {people.map((c) => {
                        const cell = r.cells[c.id];
                        if (!cell) return <td key={c.id} className="border-b border-border/40 text-center text-fg-subtle/40">·</td>;
                        const why = cell.ok
                          ? `${c.name} can make the ${r.line} (${cell.known} traits known)`
                          : `${c.name}: ${cell.known} of ${needed} traits${cell.hasTrait === false ? `, ${trait} not researched` : ""}`;
                        return (
                          <td key={c.id} title={why} className="relative h-8 border-b border-border/40 text-center text-[12px] tabular-nums">
                            {cell.ok ? (
                              <Check className="mx-auto h-3.5 w-3.5 text-ok" aria-label="Can make it" />
                            ) : cell.known >= needed ? (
                              // Enough traits; only the asked-for trait is missing.
                              <span className="text-[11px] text-danger">no trait</span>
                            ) : (
                              <>
                                <span className="text-fg-muted">
                                  {Math.min(cell.known, needed)}/{needed}
                                </span>
                                {cell.hasTrait === false ? (
                                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger" aria-hidden />
                                ) : null}
                                <span className="absolute inset-x-2 bottom-1 h-[2px] rounded-full bg-meter-track" aria-hidden>
                                  <span className="block h-full rounded-full bg-meter" style={{ width: `${Math.min(100, (cell.known / needed) * 100)}%` }} />
                                </span>
                              </>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12.5px] text-fg-subtle">
        {setName} needs {needed} traits researched on a piece
        {trait ? `, and ${trait} researched to put it on` : ""}. A tick means they can make it now; otherwise, traits known out of {needed}
        {trait ? `; a red dot or "no trait" means ${trait} itself isn't researched on that piece` : ""}.
      </p>
    </div>
  );
}


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
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-display text-[26px] text-fg">Who can craft it?</h2>
          {chosen ? (
            <CraftCheckControls
              sets={crafted.map((s) => ({ name: s.name, traitsNeeded: s.traitsNeeded ?? null }))}
              set={chosen.name}
              traits={traitNames}
              trait={trait ?? ""}
            />
          ) : null}
        </div>
        {!chosen ? (
          <p className="mt-4 text-sm text-fg-muted">The catalog has no crafted sets yet. An in-game catalog scan fills them in.</p>
        ) : needed === 0 ? (
          <p className="mt-4 text-sm text-fg-muted">
            The catalog doesn&apos;t say how many traits {chosen.name} needs yet, so Nirnside won&apos;t guess.
          </p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-fg-muted">No research captured yet.</p>
        ) : (
          <CraftGrid rows={rows} characters={characters} needed={needed} trait={trait} setName={chosen.name} />
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
