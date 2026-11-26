import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAccount, getCharacter } from "@/lib/db/queries";
import { getScripts, getSkillLineByName, setHref, catalogAbilityLoreFor } from "@/lib/db/catalog-queries";
import { loadSetHover } from "@/lib/catalog/hover-sets";
import { withResolvedSet } from "@/lib/catalog/set-brief";
import { hrefForMythicOrSet } from "@/lib/collections/mythic-match";
import { presentSkillBook, SKILL_CATEGORY_ORDER } from "@/lib/skills/present";
import { briefsFromLore } from "@/lib/skills/skill-brief";
import { presentRecipeLists, presentResearch, characterHasKnowledgeScan } from "@/lib/knowledge/present";
import type { Character, Wardrobe as WardrobeData } from "@/lib/snapshot/schema";
import { classColor } from "@/lib/classes";
import { SkillBook } from "@/components/skill-book";
import { SkillCatalogProvider } from "@/components/skill-hover";
import { SetCatalogProvider } from "@/components/set-hover";
import { CharacterLoadout } from "@/components/character-loadout";
import { Wardrobe } from "@/components/wardrobe";
import { CharacterChampion } from "@/components/character-champion";
import { CharacterScripts, type CharacterScript } from "@/components/character-scripts";
import { KnowledgeDetail } from "@/components/knowledge-board";

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

function SkillsModule({ c, cat, base }: { c: Character; cat: string | undefined; base: string }) {
  const names: string[] = [];
  const snapshotSkills: { name: string; description: string }[] = [];
  const note = (name?: string | null, description?: string | null) => {
    const n = name?.trim();
    if (!n) return;
    names.push(n);
    const d = description?.trim();
    if (d) snapshotSkills.push({ name: n, description: d });
  };
  // One skill category per page load: an endgame character's every ability,
  // morph and description at once is well over a megabyte.
  const categoryNames = [...new Set(c.skillLines.map((l) => l.category))];
  const chosen =
    cat && categoryNames.includes(cat)
      ? cat
      : (SKILL_CATEGORY_ORDER.find((x) => categoryNames.includes(x)) ?? categoryNames[0] ?? null);
  for (const line of c.skillLines.filter((l) => l.category === chosen)) {
    for (const a of line.abilities) {
      note(a.name, a.description);
      for (const m of a.morphs ?? []) note(m.name, m.description);
    }
  }
  const lore = safe(() => catalogAbilityLoreFor(names), new Map() as ReturnType<typeof catalogAbilityLoreFor>);
  const fullBook = presentSkillBook(
    c.skillLines,
    lore,
    (name) => skillLineHref(name, c.class),
    c.class,
    (name) => safe(() => getSkillLineByName(name)?.entry.className ?? null, null),
  );
  const current = fullBook.find((cg) => cg.name === chosen) ?? fullBook[0];
  const book = current ? [current] : [];
  const known = new Set(c.scribingScripts.map((s) => s.trim().toLowerCase()));
  const scripts: CharacterScript[] = safe(() => getScripts(), []).map((row) => ({
    name: row.entry.name,
    slot: row.entry.slot,
    effect: row.entry.effect ?? "",
    known: known.has(row.entry.name.trim().toLowerCase()),
    icon: row.entry.icon,
  }));
  return (
    <SkillCatalogProvider skills={briefsFromLore(names, lore, snapshotSkills)}>
      <nav aria-label="Skill categories" className="mb-4 flex flex-wrap gap-2">
        {fullBook.map((cg) => (
          <Link
            key={cg.name}
            href={`${base}/skills?cat=${encodeURIComponent(cg.name)}`}
            aria-current={cg.name === current?.name ? "page" : undefined}
            className={`rounded-xl border px-3 py-1.5 text-[13px] ${
              cg.name === current?.name ? "border-accent bg-accent-soft text-fg" : "border-border text-fg-muted hover:text-fg"
            }`}
          >
            {cg.name}
            <span className="ml-2 text-fg-subtle">{cg.lines.length}</span>
          </Link>
        ))}
      </nav>
      <SkillBook categories={book} lastSeen={c.lastSeen} characterClass={c.class} rememberKey={c.id} />
      <section className="mt-10">
        <h2 className="mb-3 font-display text-[26px] text-fg">Scribing scripts</h2>
        <CharacterScripts scripts={scripts} />
      </section>
    </SkillCatalogProvider>
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
          scribingCount: c.scribingScripts.length,
        }
      }
    />
    </div>
  );
}

export default async function CharacterModulePage({ params, searchParams }: PageProps<"/party/c/[id]/[module]">) {
  const { id, module } = await params;
  const sp = await searchParams;
  const cat = typeof sp.cat === "string" ? sp.cat : undefined;
  if (!(module in MODULES)) notFound();
  const which = module as ModuleId;
  const c = safe(() => getCharacter(decodeURIComponent(id)), null);
  if (!c) notFound();
  const base = `/party/c/${encodeURIComponent(c.id)}`;

  return (
    <div className="mx-auto w-full max-w-[1320px]">
      <Link href={base} className="mb-3 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> {c.name}
      </Link>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[44px] leading-none text-fg">
          {MODULES[which]}
          <span className="ml-3 align-middle text-[15px]" style={{ color: classColor(c.class) }}>
            {c.class}
          </span>
        </h1>
        <nav aria-label="Character modules" className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface/70 p-1">
          {(Object.keys(MODULES) as ModuleId[]).map((m) => (
            <Link
              key={m}
              href={`${base}/${m}`}
              aria-current={m === which ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-[13px] ${m === which ? "bg-surface-2 text-fg" : "text-fg-muted hover:text-fg"}`}
            >
              {MODULES[m]}
            </Link>
          ))}
        </nav>
      </header>
      {c.lastSeen == null ? (
        <p className="party-module px-5 py-8 text-center text-fg-muted">
          {c.name} hasn&apos;t logged out with the addon yet, so there&apos;s nothing to show here.
        </p>
      ) : which === "skills" ? (
        <SkillsModule c={c} cat={cat} base={base} />
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
