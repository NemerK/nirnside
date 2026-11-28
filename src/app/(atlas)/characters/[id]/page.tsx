import { esoPlainText } from "@/lib/text/eso-markup";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Droplet,
  Moon,
  ShieldQuestion,
  Sparkles,
} from "lucide-react";
import { getAccount, getCharacter } from "@/lib/db/queries";
import { loadSetHover } from "@/lib/catalog/hover-sets";
import { withResolvedSet } from "@/lib/catalog/set-brief";
import { listAssignments, listRoles } from "@/lib/db/roles";
import { listGoals } from "@/lib/db/goals";
import { skillLineChoices } from "@/lib/planner/data";
import { getSkillLineByName, getSkillsForLine, getScripts, setHref, catalogAbilityLoreFor } from "@/lib/db/catalog-queries";
import { hrefForMythicOrSet } from "@/lib/collections/mythic-links";
import type { Character, Wardrobe as WardrobeData } from "@/lib/snapshot/schema";
import { readCharacter } from "@/lib/game/understand";
import { abilityLines, classLines, gameRules, lineCap, mundusTexts } from "@/lib/db/game-knowledge";
import { rolesForCharacter } from "@/lib/roles/filter";
import { presentSkillBook } from "@/lib/skills/present";
import { briefsFromLore } from "@/lib/skills/skill-brief";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { SkillBook } from "@/components/skill-book";
import { Wardrobe } from "@/components/wardrobe";
import { RolePicker } from "@/components/role-picker";
import { CharacterGoals } from "@/components/goals-board";
import { CharacterTabs } from "@/components/character-tabs";
import { characterTab } from "@/lib/characters/sheet-tab";
import { CharacterChampion } from "@/components/character-champion";
import { CharacterScripts, type CharacterScript } from "@/components/character-scripts";
import { CharacterLoadout } from "@/components/character-loadout";
import { SetCatalogProvider } from "@/components/set-hover";
import { SkillCatalogProvider } from "@/components/skill-hover";
import { goalAppliesTo, toGoalSubject } from "@/lib/goals/progress";
import { buildGoalIndexes, characterGoalRows } from "@/lib/planner/data";
import { ALLIANCE_ACCENT, formatGold, formatNumber, timeAgo } from "@/lib/format";
import { formatResearchRemaining, presentMotifs, presentRecipeLists, presentResearch } from "@/lib/knowledge/present";
import type { AbilityPlan, LineSkillView } from "@/lib/planner/line-plan";

function skillLineHref(name: string, className?: string | null): string | null {
  try {
    const row = getSkillLineByName(name, className);
    return row ? `/encyclopedia/skills/${encodeURIComponent(row.entry.id)}` : null;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export default async function CharacterPage({ params, searchParams }: PageProps<"/characters/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const initialTab = characterTab(typeof sp.tab === "string" ? sp.tab : undefined);
  let c: Character | null = null;
  try {
    c = getCharacter(decodeURIComponent(id));
  } catch {
    c = null;
  }
  if (!c) notFound();

  // One reading of the character through the game model.
  const account = safe(() => getAccount());
  const reading = readCharacter(
    c,
    safe(classLines) ?? new Map(),
    safe(abilityLines) ?? new Map(),
    { rules: safe(gameRules) ?? undefined, mundus: safe(mundusTexts) ?? [], companions: account?.companions ?? [] },
  );
  let roles: ReturnType<typeof listRoles> = [];
  let assigned: ReturnType<typeof rolesForCharacter> = [];
  try {
    roles = listRoles();
    assigned = rolesForCharacter(c.id, roles, listAssignments());
  } catch {
    roles = [];
  }
  const accent = ALLIANCE_ACCENT[c.alliance] ?? "var(--accent)";
  const skillNames: string[] = [];
  const snapshotSkills: { name: string; description: string }[] = [];
  const noteSkill = (name?: string | null, description?: string | null) => {
    const trimmed = name?.trim();
    if (!trimmed) return;
    skillNames.push(trimmed);
    const text = description?.trim();
    if (text) snapshotSkills.push({ name: trimmed, description: text });
  };
  let lore = new Map() as ReturnType<typeof catalogAbilityLoreFor>;
  try {
    for (const line of c.skillLines) {
      for (const ability of line.abilities) {
        noteSkill(ability.name, ability.description);
        for (const morph of ability.morphs ?? []) noteSkill(morph.name, morph.description);
      }
    }
    for (const zone of c.wardrobe?.zones ?? []) {
      for (const page of zone.pages) {
        for (const setup of page.setups) {
          for (const bar of setup.bars) {
            for (const skill of bar.skills) noteSkill(skill.name, skill.description);
          }
        }
      }
    }
    lore = catalogAbilityLoreFor(skillNames);
  } catch {
    lore = new Map();
  }
  const skillBook = presentSkillBook(
    c.skillLines,
    lore,
    (name) => skillLineHref(name, c.class),
    c.class,
    (name) => {
      try {
        return getSkillLineByName(name)?.entry.className ?? null;
      } catch {
        return null;
      }
    },
  );
  const goals = safeList(() => listGoals());
  const lines = safeList(() => skillLineChoices());
  const hrefForLine: Record<string, string> = {};
  for (const g of goals) {
    if (g.domain !== "skillline") continue;
    const key = g.target.toLowerCase();
    if (hrefForLine[key]) continue;
    const dest = skillLineHref(g.target, c.class);
    if (dest) hrefForLine[key] = dest;
  }
  const roleIds = assigned.map((r) => r.id);
  const goalIndexes = safe(buildGoalIndexes) ?? { lineIndex: [], abilityIndex: [] };
  const goalSubject = toGoalSubject(c, roleIds, true);
  // Server-side marks: the browser gets one small row per applicable target.
  const goalRows = characterGoalRows(
    goals,
    goalSubject,
    goalIndexes,
    (g) => (g.domain === "skillline" ? hrefForLine[g.target.toLowerCase()] : undefined),
  );
  const knownScripts = new Set(c.scribingScripts.map((name) => name.trim().toLowerCase()));
  const scriptRows: CharacterScript[] = safeList(() => getScripts()).map((row) => ({
    name: row.entry.name,
    slot: row.entry.slot,
    effect: row.entry.effect ?? "",
    known: knownScripts.has(row.entry.name.trim().toLowerCase()),
    icon: row.entry.icon,
  }));

  // Cross-link every set worn in a Wizard's Wardrobe setup. Mythics open their
  // missing leads instead of the encyclopedia. Names come from the stickerbook
  // when an older snapshot stored the piece without a set.
  const mythics = account?.mythics ?? [];
  const hover = loadSetHover();
  const wardrobe = presentWardrobe(c.wardrobe, hover.known);
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

  const researchView = presentResearch(c.research);
  const motifView = presentMotifs(c.motifs);
  const recipeView = presentRecipeLists(c.recipeLists, "provisioning");
  const planView = presentRecipeLists(c.recipeLists, "furnishing");
  const hasKnowledge =
    researchView.total > 0 || motifView.total > 0 || recipeView.total > 0 || planView.total > 0;

  const lineBook: Record<string, { maxRank: number | null; skills: LineSkillView[] }> = {};
  for (const category of skillBook) {
    for (const line of category.lines) {
      const key = line.name.trim().toLowerCase();
      if (!key || lineBook[key]) continue;
      lineBook[key] = {
        maxRank: lineCap(line.name),
        skills: line.abilities.map((ability) => ({
          name: ability.name,
          icon: ability.icon,
          passive: ability.passive,
          purchased: ability.purchased,
          morphs: ability.morphs.map((morph) => morph.name),
        })),
      };
    }
  }
  for (const goal of goals) {
    if (goal.domain !== "skillline") continue;
    const key = goal.target.trim().toLowerCase();
    if (!key || lineBook[key]) continue;
    let skills: LineSkillView[] = [];
    try {
      const row = getSkillLineByName(goal.target, c.class);
      if (row) {
        skills = getSkillsForLine(row.entry.id).map(({ entry }) => ({
          name: entry.name,
          icon: entry.icon,
          passive: entry.type === "passive",
          purchased: null,
          morphs: entry.morphs.filter((morph) => morph.isMorph).map((morph) => morph.name),
        }));
      }
    } catch {
      skills = [];
    }
    lineBook[key] = { maxRank: lineCap(goal.target), skills };
  }
  const linePlanNames: string[] = [];
  for (const book of Object.values(lineBook)) {
    for (const skill of book.skills) {
      if (skill.name) linePlanNames.push(skill.name);
      for (const morph of skill.morphs) if (morph) linePlanNames.push(morph);
    }
  }
  let skillLore = lore;
  if (linePlanNames.length > 0) {
    try {
      skillLore = new Map([...lore, ...catalogAbilityLoreFor(linePlanNames)]);
    } catch {
      skillLore = lore;
    }
  }
  const skillBriefs = briefsFromLore([...skillNames, ...linePlanNames], skillLore, snapshotSkills);
  const abilityByName = new Map(goalIndexes.abilityIndex);
  const abilityPlans: AbilityPlan[] = [];
  for (const goal of goals) {
    if (goal.domain !== "ability" || !goalAppliesTo(goal, goalSubject)) continue;
    const meta = abilityByName.get(goal.target.trim().toLowerCase());
    if (!meta) continue;
    abilityPlans.push({ target: goal.target, tier: goal.tier, lineName: meta.lineName });
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden">
      <Link
        href="/characters"
        className="mb-3 inline-flex shrink-0 items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> All characters
      </Link>

      <Card className="mb-3 shrink-0 overflow-hidden">
        <div className="h-0.5" style={{ background: accent }} />
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <h1 className="text-lg font-semibold tracking-tight text-fg">{c.name}</h1>
              <p className="text-sm text-fg-muted">
                {c.race} {c.class} · <span style={{ color: accent }}>{c.alliance}</span>
                {c.lastSeen ? <span className="text-fg-subtle"> · {timeAgo(c.lastSeen)}</span> : null}
              </p>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {c.vampire.isVampire && (
                <Badge tone="accent">
                  <Droplet className="h-3 w-3" /> Vampire · Stage {c.vampire.stage}
                </Badge>
              )}
              {c.werewolf.isWerewolf && (
                <Badge tone="accent">
                  <Moon className="h-3 w-3" /> Werewolf
                </Badge>
              )}
              {c.classMastery && <Badge tone="muted">Class Mastery</Badge>}
              {reading.mundus.blessings.map((m) => (
                <Badge key={m.name} tone="muted">
                  <span title={[m.amount, m.text ? esoPlainText(m.text) : null].filter(Boolean).join("\n") || undefined}>{m.name}</span>
                </Badge>
              ))}
              {c.classMasteries.length > 0 && (
                <span className="inline-flex flex-wrap items-center gap-1 text-[11px] text-fg-subtle">
                  <Sparkles className="h-3 w-3 text-accent" />
                  {c.classMasteries.map((m) => (
                    <Badge key={m} tone="accent">
                      {m}
                    </Badge>
                  ))}
                </span>
              )}
              <RolePicker characterId={c.id} assigned={assigned} roles={roles} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold tabular-nums leading-none text-fg">
              {c.level >= 50 ? c.championPoints.toLocaleString("en-US") : c.level}
              <span className="ml-1.5 text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
                {c.level >= 50 ? "CP" : "Level"}
              </span>
            </div>
            {c.lastSeen ? (
              <div className="mt-1 text-xs tabular-nums text-fg-muted">
                {formatGold(c.gold ?? 0)}
                {(c.alliancePoints ?? 0) > 0 ? ` · ${formatNumber(c.alliancePoints ?? 0)} AP` : ""}
                {(c.telVar ?? 0) > 0 ? ` · ${formatNumber(c.telVar ?? 0)} TV` : ""}
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      {!c.lastSeen && (
        <Card className="mb-6 flex items-start gap-3 border-accent/40 bg-accent-soft p-4">
          <ShieldQuestion className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div className="text-sm text-fg">
            <span className="font-medium">This character hasn&apos;t been snapshotted yet.</span> The details below
            are unknown until you log this character out (or ReloadUI) with the addon installed. We show what we know
            and nothing more.
          </div>
        </Card>
      )}
      <SetCatalogProvider sets={hover.briefs}>
      <SkillCatalogProvider skills={skillBriefs}>
      <CharacterTabs
        initialTab={initialTab}
        overview={
          <>
            <SkillBook
              categories={skillBook}
              lastSeen={c.lastSeen}
              characterClass={c.class}
              rememberKey={c.id}
            />


      {(reading.companions.length > 0 || hasKnowledge) && (
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Companions */}
          {reading.companions.length > 0 && (
            <section>
              <SectionTitle>Companions</SectionTitle>
              <p className="-mt-2 mb-2 text-xs text-fg-subtle">Shared by every character on the account.</p>
              <div className="space-y-2">
                {reading.companions.map((comp) => (
                  <Card key={comp.name} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-fg">{comp.name}</span>
                    <div className="flex items-center gap-2">
                      {comp.rapport && <Badge tone="muted">{comp.rapport}</Badge>}
                      <span className="text-xs text-fg-subtle">
                        {comp.level == null ? "not seen out yet" : `Lv ${comp.level}`}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Knowledge — in-progress only here; the full grid lives on /knowledge */}
          {hasKnowledge && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle className="mb-0">Knowledge</SectionTitle>
                <Link href={`/knowledge?char=${encodeURIComponent(c.id)}`} className="text-xs text-accent hover:underline">
                  Full grid →
                </Link>
              </div>
              <div className="space-y-2">
                <Card className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 text-sm text-fg-muted">
                  {researchView.total > 0 && (
                    <span>
                      Research {researchView.known}/{researchView.total}
                    </span>
                  )}
                  {motifView.total > 0 && (
                    <span>
                      Motifs {motifView.known}/{motifView.total}
                    </span>
                  )}
                  {recipeView.total > 0 && (
                    <span>
                      Recipes {recipeView.known}/{recipeView.total}
                    </span>
                  )}
                  {planView.total > 0 && (
                    <span>
                      Plans {planView.known}/{planView.total}
                    </span>
                  )}
                  <Link href="/styles" className="text-accent hover:underline">
                    Outfit Styles
                  </Link>
                </Card>
                {researchView.inProgress.map((r) => (
                  <Card key={`${r.craft}-${r.line}-${r.trait}`} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-fg">
                      {r.craftName} · {r.line} · {r.trait}
                    </span>
                    <span className="text-fg-subtle">
                      {r.remainingSeconds != null
                        ? `${formatResearchRemaining(r.remainingSeconds)} left at last logout`
                        : "researching"}
                    </span>
                  </Card>
                ))}
              </div>
            </section>
          )}
      </div>
      )}
          </>
        }
        equipped={
          <CharacterLoadout
            equipped={c.equipped}
            attributes={c.attributes}
            wardrobe={wardrobe}
            knownSets={hover.knownList}
          />
        }
        setups={
          <Wardrobe wardrobe={wardrobe} hrefForSet={hrefForSet} characterName={c.name} characterId={c.id} />
        }
        targets={
          <CharacterGoals
            rows={goalRows}
            lines={lines}
            subjectId={c.id}
            subjectName={c.name}
            characterClass={c.class}
            lineBook={lineBook}
            abilityPlans={abilityPlans}
            catalog={{
              lines: goalIndexes.lineIndex.map(([name, meta]) => ({
                name,
                category: meta.category,
                className: meta.className,
                classNames: meta.classNames,
              })),
              abilities: goalIndexes.abilityIndex.map(([name, meta]) => ({
                name,
                lineName: meta.lineName,
                className: meta.className,
                category: meta.category,
              })),
            }}
          />
        }
        scripts={<CharacterScripts scripts={scriptRows} />}
        champion={<CharacterChampion champion={c.champion} championPoints={c.championPoints} />}
      />
      </SkillCatalogProvider>
      </SetCatalogProvider>
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

function safeList<T>(fn: () => T[]): T[] {
  try {
    return fn();
  } catch {
    return [];
  }
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
