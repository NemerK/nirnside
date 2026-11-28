import Link from "next/link";
import { notFound } from "next/navigation";
import { getAccount, getCharacter } from "@/lib/db/queries";
import { getScripts, getSkillLineByName, setHref, catalogAbilityLoreFor } from "@/lib/db/catalog-queries";
import { loadSetHover } from "@/lib/catalog/hover-sets";
import { withResolvedSet } from "@/lib/catalog/set-brief";
import { hrefForMythicOrSet } from "@/lib/collections/mythic-links";
import { presentSkillBook, SKILL_CATEGORY_ORDER } from "@/lib/skills/present";
import { lineCap } from "@/lib/db/game-knowledge";
import { isClassMasteryLineName } from "@/lib/game/class-mastery";
import { briefsFromLore } from "@/lib/skills/skill-brief";
import { presentRecipeLists, presentResearch, characterHasKnowledgeScan } from "@/lib/knowledge/present";
import type { Character, Wardrobe as WardrobeData } from "@/lib/snapshot/schema";
import { SkillBook } from "@/components/skill-book";
import { SkillCatalogProvider } from "@/components/skill-hover";
import { SetCatalogProvider } from "@/components/set-hover";
import { CharacterLoadout } from "@/components/character-loadout";
import { Wardrobe } from "@/components/wardrobe";
import { CharacterChampion } from "@/components/character-champion";
import { CharacterScripts, type CharacterScript } from "@/components/character-scripts";
import { KnowledgeDetail } from "@/components/knowledge-board";
import { getRecipes } from "@/lib/db/catalog-queries";

export const dynamic = "force-dynamic";

const MODULES = {
  skills: "Skills",
  gear: "Gear and setups",
  champion: "Champion Points",
  crafting: "Crafting",
} as const;
type ModuleId = keyof typeof MODULES;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function skillLineHref(name: string, className?: string | null): string | null {
  const row = safe(() => getSkillLineByName(name, className), null);
  return row ? `/encyclopedia/skills/${encodeURIComponent(row.entry.id)}` : null;
}

type RailLine = { name: string; category: string; rank: number; cap: number | null; subclassed: boolean };

/** Every skill line of the character, grouped as in game: one click opens any line. */
function SkillRail({
  groups,
  selected,
  base,
  view,
  scripts,
}: {
  groups: { category: string; lines: RailLine[] }[];
  selected: string | null;
  base: string;
  view: "lines" | "scribing";
  scripts: { known: number; total: number };
}) {
  return (
    <nav
      aria-label="Skill lines"
      className="party-module max-h-[calc(100dvh-8.5rem)] overflow-y-auto p-2 lg:sticky lg:top-[6.75rem]"
    >
      <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-surface-2/60 p-0.5 text-[12px]" role="group" aria-label="Show">
        <Link
          href={selected ? `${base}/skills?line=${encodeURIComponent(selected)}` : `${base}/skills`}
          aria-current={view === "lines" ? "page" : undefined}
          scroll={false}
          className={`rounded-md px-2 py-1 text-center ${view === "lines" ? "bg-surface text-fg" : "text-fg-muted hover:text-fg"}`}
        >
          Skill lines
        </Link>
        <Link
          href={`${base}/skills?view=scribing`}
          aria-current={view === "scribing" ? "page" : undefined}
          scroll={false}
          className={`rounded-md px-2 py-1 text-center ${view === "scribing" ? "bg-surface text-fg" : "text-fg-muted hover:text-fg"}`}
        >
          Scribing <span className="tabular-nums text-fg-subtle">{scripts.known}/{scripts.total}</span>
        </Link>
      </div>
      {groups.map((g) => (
        <section key={g.category} className="mb-2">
          <h2 className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{g.category}</h2>
          <ul>
            {g.lines.map((l) => {
              const on = view === "lines" && l.name === selected;
              const done = l.cap != null && l.rank >= l.cap;
              return (
                <li key={`${g.category}-${l.name}`}>
                  <Link
                    href={`${base}/skills?line=${encodeURIComponent(l.name)}`}
                    aria-current={on ? "page" : undefined}
                    scroll={false}
                    className={`block rounded-lg px-2 py-1 ${on ? "bg-accent-soft" : "hover:bg-surface-2"}`}
                  >
                    <span className="flex items-baseline justify-between gap-2 text-[13px]">
                      <span className={`truncate ${on ? "text-fg" : done ? "text-fg-muted" : "text-fg"}`}>
                        {l.name}
                        {l.subclassed ? <span className="ml-1 text-[11px] text-info">subclass</span> : null}
                      </span>
                      <span className={`shrink-0 text-[12px] tabular-nums ${done ? "text-ok" : "text-fg-subtle"}`}>
                        {l.rank}
                        {l.cap && !done ? <span className="text-fg-subtle/70">/{l.cap}</span> : null}
                      </span>
                    </span>
                    {l.cap && !done ? (
                      <span className="mt-0.5 block h-[3px] overflow-hidden rounded-full bg-meter-track" aria-hidden>
                        <span className="block h-full rounded-full bg-meter" style={{ width: `${(l.rank / l.cap) * 100}%` }} />
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}

function SkillsModule({
  c,
  cat,
  lineName,
  view,
  base,
}: {
  c: Character;
  cat: string | undefined;
  lineName: string | undefined;
  view: "lines" | "scribing";
  base: string;
}) {
  // The rail: every line, cheap (names and ranks only).
  const order = (x: string) => {
    const i = SKILL_CATEGORY_ORDER.indexOf(x as (typeof SKILL_CATEGORY_ORDER)[number]);
    return i < 0 ? 99 : i;
  };
  const railLines: RailLine[] = c.skillLines
    .filter((l) => !isClassMasteryLineName(l.name))
    .map((l) => ({ name: l.name, category: l.category, rank: l.rank, cap: l.maxRank ?? lineCap(l.name), subclassed: !!l.subclassed }));
  const groups = [...new Set(railLines.map((l) => l.category))]
    .sort((a, b) => order(a) - order(b))
    .map((category) => ({
      category,
      lines: railLines.filter((l) => l.category === category).sort((a, b) => Number(a.subclassed) - Number(b.subclassed)),
    }));
  const flat = groups.flatMap((g) => g.lines);
  const selected =
    flat.find((l) => l.name === lineName) ??
    (cat ? flat.find((l) => l.category === cat) : undefined) ??
    flat[0] ??
    null;

  const known = new Set(c.scribingScripts.map((s) => s.trim().toLowerCase()));
  const allScripts = safe(() => getScripts(), []);
  const scriptCount = { known: allScripts.filter((r) => known.has(r.entry.name.trim().toLowerCase())).length, total: allScripts.length };

  if (view === "scribing") {
    const scripts: CharacterScript[] = allScripts.map((row) => ({
      name: row.entry.name,
      slot: row.entry.slot,
      effect: row.entry.effect ?? "",
      known: known.has(row.entry.name.trim().toLowerCase()),
      icon: row.entry.icon,
    }));
    return (
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <SkillRail groups={groups} selected={null} base={base} view="scribing" scripts={scriptCount} />
        <div className="min-w-0">
          <CharacterScripts scripts={scripts} />
        </div>
      </div>
    );
  }

  // The detail: one category's abilities and descriptions, the one the chosen line is in.
  const chosen = selected?.category ?? null;
  const names: string[] = [];
  const snapshotSkills: { name: string; description: string }[] = [];
  const note = (name?: string | null, description?: string | null) => {
    const n = name?.trim();
    if (!n) return;
    names.push(n);
    const d = description?.trim();
    if (d) snapshotSkills.push({ name: n, description: d });
  };
  for (const line of c.skillLines.filter((l) => l.name === selected?.name)) {
    for (const a of line.abilities) {
      note(a.name, a.description);
      for (const m of a.morphs ?? []) note(m.name, m.description);
    }
  }
  const lore = safe(() => catalogAbilityLoreFor(names), new Map() as ReturnType<typeof catalogAbilityLoreFor>);
  const fullBook = presentSkillBook(
    c.skillLines.filter((l) => l.category === chosen),
    lore,
    (name) => skillLineHref(name, c.class),
    c.class,
    (name) => safe(() => getSkillLineByName(name)?.entry.className ?? null, null),
  );
  const current = fullBook.find((cg) => cg.lines.some((l) => l.name === selected?.name)) ?? fullBook[0];
  const lineView = current?.lines.find((l) => l.name === selected?.name) ?? current?.lines[0];
  const book = current && lineView ? [{ ...current, lines: [lineView] }] : [];

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <SkillRail groups={groups} selected={selected?.name ?? null} base={base} view="lines" scripts={scriptCount} />
      <div className="min-w-0">
        {book.length === 0 ? (
          <p className="party-module px-5 py-8 text-center text-fg-muted">No skills captured yet.</p>
        ) : (
          <SkillCatalogProvider skills={briefsFromLore(names, lore, snapshotSkills)}>
            <SkillBook
              key={lineView?.id}
              categories={book}
              lastSeen={c.lastSeen}
              characterClass={c.class}
              lineOnly
            />
          </SkillCatalogProvider>
        )}
      </div>
    </div>
  );
}

function presentWardrobe(wardrobe: WardrobeData | null | undefined, known: ReturnType<typeof loadSetHover>["known"]) {
  if (!wardrobe) return wardrobe;
  return {
    ...wardrobe,
    zones: wardrobe.zones.map((zone) => ({
      ...zone,
      pages: zone.pages.map((page) => ({
        ...page,
        setups: page.setups.map((setup) => ({
          ...setup,
          gear: setup.gear.map((piece) => withResolvedSet(piece, known)),
          food: setup.food?.name ? withResolvedSet(setup.food, known) : setup.food,
        })),
      })),
    })),
  };
}

function GearModule({ c }: { c: Character }) {
  const hover = loadSetHover();
  const wardrobe = presentWardrobe(c.wardrobe, hover.known);
  const mythics = safe(() => getAccount()?.mythics ?? [], []);
  const hrefForSet: Record<string, string> = {};
  for (const zone of wardrobe?.zones ?? []) {
    for (const page of zone.pages) {
      for (const setup of page.setups) {
        for (const piece of setup.gear) {
          if (!piece.setName) continue;
          const key = piece.setName.toLowerCase();
          if (hrefForSet[key]) continue;
          hrefForSet[key] = hrefForMythicOrSet(
            mythics,
            { name: piece.setName, setId: piece.setId },
            setHref({ name: piece.setName, setId: piece.setId }),
          );
        }
      }
    }
  }
  return (
    <SetCatalogProvider sets={hover.briefs}>
      <CharacterLoadout equipped={c.equipped} attributes={c.attributes} wardrobe={wardrobe} knownSets={hover.knownList} />
      <section id="setups" className="mt-10 scroll-mt-6">
        <h2 className="mb-3 font-display text-[26px] text-fg">Wizard&apos;s Wardrobe setups</h2>
        <Wardrobe wardrobe={wardrobe} hrefForSet={hrefForSet} characterName={c.name} characterId={c.id} />
      </section>
    </SetCatalogProvider>
  );
}

/** Every recipe and plan from the catalog scan; empty until one (Catalog 0.2.11+). */
function recipeBookEntries() {
  try {
    return getRecipes().map((r) => r.entry);
  } catch {
    return [];
  }
}

function CraftingModule({ c }: { c: Character }) {
  return (
    <div className="party-module p-5">
    <KnowledgeDetail
      character={
        {
          id: c.id,
          name: c.name,
          className: c.class,
          scanned: characterHasKnowledgeScan(c),
          research: presentResearch(c.research),
          motifs: c.motifs ?? [],
          recipes: presentRecipeLists(c.recipeLists, "provisioning").lists,
          plans: presentRecipeLists(c.recipeLists, "furnishing").lists,
          craftLevels: c.craftLevels ?? null,
          scribingCount: c.scribingScripts.length,
        }
      }
      recipeBook={recipeBookEntries()}
    />
    </div>
  );
}

export default async function CharacterModulePage({ params, searchParams }: PageProps<"/party/c/[id]/[module]">) {
  const { id, module } = await params;
  const sp = await searchParams;
  const cat = typeof sp.cat === "string" ? sp.cat : undefined;
  const lineName = typeof sp.line === "string" ? sp.line : undefined;
  const view = sp.view === "scribing" ? "scribing" : "lines";
  if (!(module in MODULES)) notFound();
  const which = module as ModuleId;
  const c = safe(() => getCharacter(decodeURIComponent(id)), null);
  if (!c) notFound();
  const base = `/party/c/${encodeURIComponent(c.id)}`;

  return (
    <div className="mx-auto w-full max-w-[1320px]">
      <h1 className="sr-only">
        {c.name}: {MODULES[which]}
      </h1>
      {c.lastSeen == null ? (
        <p className="party-module px-5 py-8 text-center text-fg-muted">
          {c.name} hasn&apos;t logged out with the addon yet, so there&apos;s nothing to show here.
        </p>
      ) : which === "skills" ? (
        <SkillsModule c={c} cat={cat} lineName={lineName} view={view} base={base} />
      ) : which === "gear" ? (
        <GearModule c={c} />
      ) : which === "champion" ? (
        <CharacterChampion champion={c.champion} championPoints={c.championPoints} />
      ) : (
        <CraftingModule c={c} />
      )}
    </div>
  );
}
