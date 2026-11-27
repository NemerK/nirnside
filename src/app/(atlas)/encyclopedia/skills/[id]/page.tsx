import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSkillLine, getSkillsForLine } from "@/lib/db/catalog-queries";
import { charactersKnowingSkill } from "@/lib/db/overlay";
import { getCharactersFull } from "@/lib/db/queries";
import { liveCharacters } from "@/lib/snapshot/roster";
import { Badge, Card } from "@/components/ui";
import { EsoText } from "@/components/eso-text";
import { GameIcon } from "@/components/game-icon";
import { SkillLineRoster } from "@/components/skill-line-roster";
import { SkillLineTabs, type SkillLineTabId } from "@/components/skill-line-tabs";
import { SourceBadge } from "@/components/source-badge";
import { plannerLineIcon } from "@/lib/icons/planner-icons";
import { resolveSkillIcon, skillIconByName } from "@/lib/icons/skill-icons";
import { CLASS_MASTERY_POINTS, isClassMasteryLineName } from "@/lib/game/class-mastery";
import { skillLineCap } from "@/lib/game/skill-caps";
import { skillLineRoster } from "@/lib/skills/line-roster";

export const dynamic = "force-dynamic";

const TYPE_TONE = { ultimate: "accent", active: "default", passive: "muted" } as const;

export default async function SkillLinePage({
  params,
  searchParams,
}: PageProps<"/encyclopedia/skills/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const requested = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const tab: SkillLineTabId = requested === "roster" ? "roster" : "line";
  const row = safe(() => getSkillLine(decodeURIComponent(id)));
  if (!row) notFound();
  const { entry: line, source } = row;
  const skills = safe(() => getSkillsForLine(line.id)) ?? [];
  const classMastery = isClassMasteryLineName(line.name);
  const roster = skillLineRoster(
    { name: line.name, className: line.className, classMastery },
    skills.map(({ entry }) => ({
      id: entry.id,
      name: entry.name,
      type: entry.type,
      morphs: entry.morphs.map((morph) => morph.name),
    })),
    (safe(() => liveCharacters(getCharactersFull())) ?? []).map((character) => ({
      id: character.id,
      name: character.name,
      className: character.class,
      archivedAt: character.archivedAt,
      skillLines: character.skillLines,
    })),
    classMastery ? CLASS_MASTERY_POINTS : skillLineCap(line.name),
  );

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/encyclopedia/skills" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Skills
      </Link>

      <Card className="mb-6 p-6">
        <div className="flex items-start gap-3">
          <GameIcon
            name={line.name}
            icon={plannerLineIcon({
              name: line.name,
              className: line.className,
              catalogIcon: line.icon,
              abilityIcon: skills
                .map(({ entry: sk }) => sk.icon?.trim() || resolveSkillIcon(sk.name, sk.morphs.map((morph) => morph.name)))
                .find(Boolean),
            })}
            size={48}
          />
          <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{line.name}</h1>
          <SourceBadge source={source} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
          <Badge tone="muted">{line.category}</Badge>
          {line.className && <Badge tone="muted">{line.className}</Badge>}
        </div>
          </div>
        </div>
      </Card>

      <SkillLineTabs
        initial={tab}
        line={
          skills.length === 0 ? (
            <Card className="px-4 py-8 text-center text-sm text-fg-muted">
              Abilities for this line will populate from the in-game catalog scan.
            </Card>
          ) : (
            <div className="space-y-3">
              {skills.map(({ entry: sk, source: ss }) => {
                const morphNames = sk.morphs.map((m) => m.name);
                const known = charactersKnowingSkill([sk.name, ...morphNames]);
                const baseIcon = sk.icon?.trim() || resolveSkillIcon(sk.name, morphNames);
                return (
                  <Card key={sk.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <GameIcon name={sk.name} icon={baseIcon} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-fg">{sk.name}</span>
                          <Badge tone={TYPE_TONE[sk.type]}>{sk.type}</Badge>
                          {known.length > 0 && <Badge tone="accent">Known ×{known.length}</Badge>}
                          <span className="ml-auto">
                            <SourceBadge source={ss} />
                          </span>
                        </div>
                        {sk.description ? (
                          <p className="mt-1.5 text-sm text-fg-muted">
                            <EsoText text={sk.description} />
                          </p>
                        ) : null}
                        {sk.morphs.length > 0 && (
                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {sk.morphs.map((m, i) => (
                              <div key={i} className="rounded-lg border border-border bg-surface-2/60 p-2.5">
                                <div className="flex items-center gap-2 text-sm font-medium text-fg">
                                  <GameIcon name={m.name} icon={m.icon || skillIconByName(m.name) || baseIcon} size={28} />
                                  {m.name}
                                </div>
                                {m.description ? (
                                  <p className="mt-0.5 text-xs text-fg-muted">
                                    <EsoText text={m.description} />
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        }
        roster={<SkillLineRoster rows={roster} />}
      />
    </div>
  );
}

function safe<T>(fn: () => T): T | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
