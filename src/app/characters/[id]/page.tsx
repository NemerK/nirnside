import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Droplet,
  Moon,
  ShieldQuestion,
  Sparkles,
  Star,
  Swords,
  Users,
} from "lucide-react";
import { getCharacter } from "@/lib/db/queries";
import { getSkillLineByName, setHref } from "@/lib/db/catalog-queries";
import type { Character } from "@/lib/snapshot/schema";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { ALLIANCE_ACCENT, formatDateTime, qualityText, timeAgo } from "@/lib/format";

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

  const accent = ALLIANCE_ACCENT[c.alliance] ?? "var(--accent)";
  const front = c.equipped.filter((e) => e.bar === "front");
  const back = c.equipped.filter((e) => e.bar === "back");
  const armorJewelry = c.equipped.filter((e) => e.bar === null);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/characters" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> All characters
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
              {c.classMastery && <Badge tone="muted">Class Mastery</Badge>}
              {c.mundus && <Badge tone="muted">{c.mundus}</Badge>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold text-fg">
              {c.level >= 50 ? c.championPoints : c.level}
            </div>
            <div className="text-xs uppercase tracking-wider text-fg-subtle">
              {c.level >= 50 ? "Champion Points" : "Level"}
            </div>
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
      {c.lastSeen && (
        <p className="mb-6 text-sm text-fg-subtle">
          Snapshot taken {formatDateTime(c.lastSeen)} · {timeAgo(c.lastSeen)}
        </p>
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

          {/* Skill lines */}
          <section>
            <SectionTitle>Skill Lines</SectionTitle>
            {c.skillLines.length === 0 ? (
              <Card className="px-4 py-6 text-sm text-fg-muted">No skills captured yet.</Card>
            ) : (
              <div className="space-y-3">
                {c.skillLines.map((line, i) => {
                  const href = skillLineHref(line.name);
                  return (
                  <Card key={i} className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {href ? (
                          <Link href={href} className="font-medium text-fg hover:text-accent hover:underline">
                            {line.name}
                          </Link>
                        ) : (
                          <span className="font-medium text-fg">{line.name}</span>
                        )}
                        <Badge tone="muted">{line.category}</Badge>
                        {line.subclassed && <Badge tone="accent">Subclassed</Badge>}
                      </div>
                      <span className="text-xs text-fg-subtle">Rank {line.rank}</span>
                    </div>
                    {line.abilities.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {line.abilities.map((a, j) => (
                          <span
                            key={j}
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                              a.purchased ? "border-border bg-surface-2 text-fg" : "border-border/60 text-fg-subtle"
                            }`}
                            title={a.skillStyle ? `Skill style: ${a.skillStyle}` : undefined}
                          >
                            {a.name}
                            {a.morph !== null && a.morph > 0 && <span className="text-accent">◆</span>}
                            {a.skillStyle && <Sparkles className="h-3 w-3 text-accent" />}
                          </span>
                        ))}
                      </div>
                    )}
                  </Card>
                  );
                })}
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
