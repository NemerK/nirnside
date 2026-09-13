import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { getSkillLine, getSkillsForLine } from "@/lib/db/catalog-queries";
import { charactersKnowingSkill, charactersWithSkillLine } from "@/lib/db/overlay";
import { Badge, Card, PageHeader } from "@/components/ui";
import { GameIcon } from "@/components/game-icon";
import { SourceBadge } from "@/components/source-badge";

export const dynamic = "force-dynamic";

const TYPE_TONE = { ultimate: "accent", active: "default", passive: "muted" } as const;

export default async function SkillLinePage({ params }: PageProps<"/encyclopedia/skills/[id]">) {
  const { id } = await params;
  const row = safe(() => getSkillLine(decodeURIComponent(id)));
  if (!row) notFound();
  const { entry: line, source } = row;
  const skills = safe(() => getSkillsForLine(line.id)) ?? [];
  const knownBy = safe(() => charactersWithSkillLine(line.name)) ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/encyclopedia/skills" className="mb-4 inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Skills
      </Link>

      <Card className="mb-6 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{line.name}</h1>
          <SourceBadge source={source} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
          <Badge tone="muted">{line.category}</Badge>
          {line.className && <Badge tone="muted">{line.className}</Badge>}
        </div>
        {knownBy.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-fg-muted">
            <Users className="h-4 w-4 text-accent" /> Discovered by:
            {knownBy.map((c) => (
              <Link key={c.id} href={`/characters/${encodeURIComponent(c.id)}`} className="text-accent hover:underline">
                {c.name} ({c.detail})
              </Link>
            ))}
          </div>
        )}
      </Card>

      {skills.length === 0 ? (
        <Card className="px-4 py-8 text-center text-sm text-fg-muted">
          Abilities for this line will populate from the in-game catalog scan.
        </Card>
      ) : (
        <div className="space-y-3">
          {skills.map(({ entry: sk, source: ss }) => {
            const morphNames = sk.morphs.map((m) => m.name);
            const known = charactersKnowingSkill([sk.name, ...morphNames]);
            return (
              <Card key={sk.id} className="p-4">
                <div className="flex items-start gap-3">
                  <GameIcon name={sk.name} icon={sk.icon} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-fg">{sk.name}</span>
                      <Badge tone={TYPE_TONE[sk.type]}>{sk.type}</Badge>
                      {known.length > 0 && <Badge tone="accent">Known ×{known.length}</Badge>}
                      <span className="ml-auto">
                        <SourceBadge source={ss} />
                      </span>
                    </div>
                    {sk.description && <p className="mt-1.5 text-sm text-fg-muted">{sk.description}</p>}
                    {sk.morphs.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {sk.morphs.map((m, i) => (
                          <div key={i} className="rounded-lg border border-border bg-surface-2/60 p-2.5">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-fg">
                              <span className="text-accent">◆</span> {m.name}
                            </div>
                            {m.description && <p className="mt-0.5 text-xs text-fg-muted">{m.description}</p>}
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
      )}
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
