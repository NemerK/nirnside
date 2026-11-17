import Link from "next/link";
import { Users } from "lucide-react";
import { Badge, Card, ProgressBar } from "@/components/ui";
import type { CharacterLineProgress } from "@/lib/skills/line-roster";

function summary(rows: CharacterLineProgress[]): string {
  const learned = rows.filter((row) => row.state === "learned").length;
  const undiscovered = rows.filter((row) => row.state === "undiscovered").length;
  const other = rows.filter((row) => row.state === "other-class").length;
  const parts = [`${learned} learned`];
  if (undiscovered > 0) parts.push(`${undiscovered} not discovered`);
  if (other > 0) parts.push(`${other} on another class`);
  return parts.join(" · ");
}

function rankText(row: CharacterLineProgress): string {
  if (row.state === "other-class") return "Not on this class";
  if (row.state === "undiscovered") return "Not discovered";
  if (row.classMastery) {
    if (row.cap != null && row.points != null) return `${row.points} / ${row.cap} points`;
    return row.points != null ? `${row.points} points` : "Class Mastery";
  }
  if (row.rank != null && row.cap != null) return `Rank ${row.rank} / ${row.cap}`;
  if (row.rank != null) return `Rank ${row.rank}`;
  return "Discovered";
}

function abilityText(ability: CharacterLineProgress["abilities"][number]): string {
  if (!ability.inSnapshot) return "Not in this snapshot";
  if (!ability.known) return "Not purchased";
  const sameName = !ability.face || ability.face.trim().toLowerCase() === ability.name.trim().toLowerCase();
  if (sameName) return ability.rankLabel ?? "Learned";
  return ability.rankLabel ? `${ability.face} · ${ability.rankLabel}` : ability.face!;
}

export function SkillLineRoster({ rows }: { rows: CharacterLineProgress[] }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
          <Users className="h-3.5 w-3.5" /> Your characters
        </h2>
        {rows.length > 0 ? <span className="text-xs text-fg-subtle">{summary(rows)}</span> : null}
      </div>
      {rows.length === 0 ? (
        <Card className="px-4 py-6 text-sm text-fg-muted">No characters on this account yet.</Card>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const value = row.classMastery ? (row.points ?? 0) : (row.rank ?? 0);
            const showBar = row.state === "learned" && row.cap != null && row.cap > 0;
            return (
              <Card key={row.id} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Link
                      href={`/characters/${encodeURIComponent(row.id)}`}
                      className="font-medium text-fg hover:text-accent hover:underline"
                    >
                      {row.name}
                    </Link>
                    <span className="text-xs text-fg-subtle">{row.className}</span>
                    {row.subclassed ? <Badge tone="accent">Subclassed</Badge> : null}
                  </div>
                  <span className={`text-sm tabular-nums ${row.state === "learned" ? "text-fg" : "text-fg-muted"}`}>
                    {rankText(row)}
                  </span>
                </div>
                {showBar ? (
                  <div className="mt-2">
                    <ProgressBar value={Math.min(value, row.cap ?? value)} max={row.cap ?? 1} />
                  </div>
                ) : null}
                {row.state === "learned" && row.abilities.length > 0 ? (
                  <ul className="mt-3 divide-y divide-border/60">
                    {row.abilities.map((ability) => (
                      <li key={ability.id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                        <span className="min-w-0 truncate text-fg-muted">{ability.name}</span>
                        <span className={`shrink-0 text-right ${ability.known ? "text-fg" : "text-fg-subtle"}`}>
                          {abilityText(ability)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
