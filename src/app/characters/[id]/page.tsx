import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Backpack,
  Droplet,
  Moon,
  ShieldQuestion,
  Sparkles,
  Star,
  Swords,
  Users,
} from "lucide-react";
import { getCharacter, getItemsForCharacter } from "@/lib/db/queries";
import { listAssignments, listRoles } from "@/lib/db/roles";
import { listGoals, skillLineChoices } from "@/lib/db/goals";
import { getSkillLineByName, setHref, catalogAbilityLore } from "@/lib/db/catalog-queries";
import type { Character } from "@/lib/snapshot/schema";
import { isArchived } from "@/lib/snapshot/roster";
import { rolesForCharacter } from "@/lib/roles/filter";
import { presentSkillBook } from "@/lib/skills/present";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { SkillBook } from "@/components/skill-book";
import { Wardrobe } from "@/components/wardrobe";
import { RolePicker } from "@/components/role-picker";
import { CharacterGoals } from "@/components/goals-board";
import { toGoalSubject } from "@/lib/goals/progress";
import { ALLIANCE_ACCENT, formatDateTime, formatGold, formatNumber, locationLabel, qualityText, timeAgo } from "@/lib/format";

function skillLineHref(name: string): string | null {
  try {
    const row = getSkillLineByName(name);
    return row ? `/encyclopedia/skills/${encodeURIComponent(row.entry.id)}` : null;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

export default async function CharacterPage({ params }: PageProps<"/characters/[id]">) {
  const { id } = await params;
  let c: Character | null = null;
  try {
    c = getCharacter(decodeURIComponent(id));
  } catch {
    c = null;
  }
  if (!c) notFound();

  const archived = isArchived(c);
  let bags: ReturnType<typeof getItemsForCharacter> = [];
  if (archived) {
    try {
      bags = getItemsForCharacter(c);
    } catch {
      bags = [];
    }
  }
  let roles: ReturnType<typeof listRoles> = [];
  let assigned: ReturnType<typeof rolesForCharacter> = [];
  try {
    roles = listRoles();
    assigned = rolesForCharacter(c.id, roles, listAssignments());
  } catch {
    roles = [];
  }
  const accent = ALLIANCE_ACCENT[c.alliance] ?? "var(--accent)";
  const front = c.equipped.filter((e) => e.bar === "front");
  const back = c.equipped.filter((e) => e.bar === "back");
  const armorJewelry = c.equipped.filter((e) => e.bar === null);
  let lore = new Map() as ReturnType<typeof catalogAbilityLore>;
  try {
    lore = catalogAbilityLore();
  } catch {
    lore = new Map();
  }
  const skillBook = presentSkillBook(c.skillLines, lore, skillLineHref);
  const goals = safeList(() => listGoals());
  const lines = safeList(() => skillLineChoices());
  const hrefForLine: Record<string, string> = {};
  for (const g of goals) {
    const key = g.lineName.toLowerCase();
    if (hrefForLine[key]) continue;
    const dest = skillLineHref(g.lineName);
    if (dest) hrefForLine[key] = dest;
  }

  // Cross-link every set worn in a Wizard's Wardrobe setup back to its catalog page.
  const hrefForSet: Record<string, string> = {};
  for (const zone of c.wardrobe?.zones ?? []) {
    for (const page of zone.pages) {
      for (const setup of page.setups) {
        for (const piece of setup.gear) {
          if (!piece.setName) continue;
          const key = piece.setName.toLowerCase();
          if (hrefForSet[key]) continue;
          hrefForSet[key] = setHref({ name: piece.setName });
        }
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={archived ? "/characters#archive" : "/characters"}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> {archived ? "Archive" : "All characters"}
      </Link>

      <Card className="mb-6 overflow-hidden">
        <div className="h-1" style={{ background: accent }} />
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{c.name}</h1>
            <p className="mt-1 text-fg-muted">
              {c.race} {c.class} · <span style={{ color: accent }}>{c.alliance}</span>
              {c.gender ? ` · ${c.gender}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
              {!c.vampire.isVampire && !c.werewolf.isWerewolf && <Badge tone="muted">Mortal</Badge>}
              {archived && (
                <Badge tone="muted">
                  <Archive className="h-3 w-3" /> Archived
                </Badge>
              )}
              {c.classMastery && <Badge tone="muted">Class Mastery</Badge>}
              {c.mundus && <Badge tone="muted">{c.mundus}</Badge>}
            </div>
            <div className="mt-3">
              <RolePicker characterId={c.id} assigned={assigned} roles={roles} />
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold text-fg">
              {c.level >= 50 ? c.championPoints : c.level}
            </div>
            <div className="text-xs uppercase tracking-wider text-fg-subtle">
              {c.level >= 50 ? "Champion Points" : "Level"}
            </div>
            {c.lastSeen ? (
              <div className="mt-2 text-sm tabular-nums text-fg-muted">
                {formatGold(c.gold ?? 0)}
                <div className="text-xs uppercase tracking-wider text-fg-subtle">
                  {archived ? "Last-known wallet" : "Wallet"}
                </div>
                {(c.telVar ?? 0) > 0 && (
                  <div className="mt-1 text-xs text-fg-subtle">{formatNumber(c.telVar ?? 0)} Tel Var</div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </Card>

      {archived && (
        <Card className="mb-6 flex items-start gap-3 border-border bg-surface-2 p-4">
          <Archive className="mt-0.5 h-5 w-5 shrink-0 text-fg-muted" />
          <div className="text-sm text-fg">
            <span className="font-medium">This character is no longer on the live ESO roster.</span> The snapshot
            below is last-known only — gold and bags here are not counted in the account total or Inventory.
          </div>
        </Card>
      )}
      {!c.lastSeen && !archived && (
        <Card className="mb-6 flex items-start gap-3 border-accent/40 bg-accent-soft p-4">
          <ShieldQuestion className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div className="text-sm text-fg">
            <span className="font-medium">This character hasn&apos;t been snapshotted yet.</span> The details below
            are unknown until you log this character out (or ReloadUI) with the addon installed. We show what we know
            and nothing more.
          </div>
        </Card>
      )}
      {c.lastSeen && (
        <p className="mb-6 text-sm text-fg-subtle">
          Snapshot taken {formatDateTime(c.lastSeen)} · {timeAgo(c.lastSeen)}
        </p>
      )}

      <CharacterGoals goals={goals} subject={toGoalSubject(c)} lines={lines} hrefForLine={hrefForLine} />

      <div className="mt-6">
        <SkillBook categories={skillBook} lastSeen={c.lastSeen} />
      </div>

      {c.wardrobe && (c.wardrobe.zones?.length ?? 0) > 0 && (
        <div className="mt-6">
          <Wardrobe wardrobe={c.wardrobe} hrefForSet={hrefForSet} characterName={c.name} characterId={c.id} />
        </div>
      )}

      {archived && (
        <section className="mb-6">
          <SectionTitle>Last-known bags</SectionTitle>
          {bags.length === 0 ? (
            <Card className="px-4 py-6 text-sm text-fg-muted">No backpack or worn items were captured before deletion.</Card>
          ) : (
            <Card className="overflow-hidden">
              <ul className="divide-y divide-border">
                {bags.map((it, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <div className={`truncate text-sm font-medium ${qualityText(it.quality)}`}>{it.name}</div>
                      <div className="text-xs text-fg-subtle">{locationLabel(it.location)}</div>
                    </div>
                    <span className="shrink-0 tabular-nums text-sm text-fg-muted">
                      {it.count.toLocaleString("en-US")}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border px-4 py-2.5 text-xs text-fg-subtle">
                <Backpack className="mr-1 inline h-3 w-3" />
                Not included in{" "}
                <Link href="/inventory" className="text-accent hover:underline">
                  Inventory
                </Link>
                . These stacks left the account when the character was deleted.
              </div>
            </Card>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Equipped gear */}
          <section>
            <SectionTitle>Equipped</SectionTitle>
            {c.equipped.length === 0 ? (
              <Card className="px-4 py-6 text-sm text-fg-muted">No gear captured for this character yet.</Card>
            ) : (
              <div className="space-y-4">
                {armorJewelry.length > 0 && <GearGroup title="Armor & Jewelry" items={armorJewelry} icon={<Users className="h-4 w-4" />} />}
                {front.length > 0 && <GearGroup title="Front Bar" items={front} icon={<Swords className="h-4 w-4" />} />}
                {back.length > 0 && <GearGroup title="Back Bar" items={back} icon={<Swords className="h-4 w-4" />} />}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* Champion points */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle className="mb-0">Champion Points</SectionTitle>
              <Link href="/encyclopedia/champion-points" className="text-xs text-accent hover:underline">
                Tree & planner →
              </Link>
            </div>
            {c.champion.length === 0 ? (
              <Card className="px-4 py-6 text-sm text-fg-muted">None slotted or not captured.</Card>
            ) : (
              <div className="space-y-3">
                {c.champion.map((disc, i) => (
                  <Card key={i} className="p-4">
                    <div className="mb-2 flex items-center gap-2 font-medium text-fg">
                      <Star className="h-4 w-4 text-accent" /> {disc.name}
                    </div>
                    <ul className="space-y-1.5">
                      {disc.stars.map((s, j) => (
                        <li key={j} className="flex items-center justify-between text-sm">
                          <span className={s.slotted ? "text-fg" : "text-fg-subtle"}>
                            {s.slotted && <span className="mr-1 text-accent">●</span>}
                            {s.name}
                          </span>
                          <span className="text-fg-muted">{s.points}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* Attributes */}
          <section>
            <SectionTitle>Attributes</SectionTitle>
            <Card className="grid grid-cols-3 divide-x divide-border">
              {(["magicka", "health", "stamina"] as const).map((k) => (
                <div key={k} className="px-3 py-3 text-center">
                  <div className="text-lg font-semibold text-fg">{c.attributes[k] ?? 0}</div>
                  <div className="text-xs capitalize text-fg-subtle">{k}</div>
                </div>
              ))}
            </Card>
          </section>

          {/* Companions */}
          {c.companions.length > 0 && (
            <section>
              <SectionTitle>Companions</SectionTitle>
              <div className="space-y-2">
                {c.companions.map((comp, i) => (
                  <Card key={i} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-fg">{comp.name}</span>
                    <div className="flex items-center gap-2">
                      {comp.rapport && <Badge tone="muted">{comp.rapport}</Badge>}
                      <span className="text-xs text-fg-subtle">Lv {comp.level}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Scribing */}
          {c.scribingScripts.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <SectionTitle className="mb-0">Scribing Scripts</SectionTitle>
                <Link href="/encyclopedia/scribing" className="text-xs text-accent hover:underline">
                  Combinations →
                </Link>
              </div>
              <Card className="flex flex-wrap gap-1.5 p-4">
                {c.scribingScripts.map((s, i) => (
                  <Badge key={i} tone="default">
                    {s}
                  </Badge>
                ))}
              </Card>
            </section>
          )}

          {/* Research */}
          {c.research.length > 0 && (
            <section>
              <SectionTitle>Research</SectionTitle>
              <div className="space-y-2">
                {c.research.map((r, i) => (
                  <Card key={i} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <span className="text-fg">
                      {r.craft} · {r.trait}
                    </span>
                    <span className="text-fg-subtle">{r.remaining}</span>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function GearGroup({
  title,
  items,
  icon,
}: {
  title: string;
  items: Character["equipped"];
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
        {icon} {title}
      </div>
      <ul className="divide-y divide-border">
        {items.map((e, i) => (
          <li key={i} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <div className={`truncate text-sm font-medium ${qualityText(e.quality)}`}>{e.name}</div>
              <div className="mt-0.5 flex flex-wrap gap-1.5 text-xs text-fg-subtle">
                <span>{e.slot}</span>
                {e.setName && (
                  <Link href={setHref({ name: e.setName })} className="text-accent hover:underline">
                    · {e.setName}
                  </Link>
                )}
                {e.trait && <span>· {e.trait}</span>}
                {e.enchant && <span>· {e.enchant}</span>}
              </div>
            </div>
            {e.scribing.length > 0 && (
              <Badge tone="accent" className="shrink-0">
                <Sparkles className="h-3 w-3" /> {e.scribing[0]}
              </Badge>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function safeList<T>(fn: () => T[]): T[] {
  try {
    return fn();
  } catch {
    return [];
  }
}
